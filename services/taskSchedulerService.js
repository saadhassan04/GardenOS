/**
 * Task scheduler service (Business layer, L3) — API_DESIGN.md §2, FR-4,
 * T-080–T-082/T-084. Task lifecycle, the inbox/calendar queries, the
 * complete-task → auto-log care event flow (fully undoable), recurring
 * instance spawning.
 */

import { validateTask } from '../models/Task.js';
import { Repository } from '../database/Repository.js';
import { plantRepository } from '../database/PlantRepository.js';
import { STORES } from '../database/stores.js';
import { EVENT_TYPES } from '../config/registries.js';
import { computeNextDueAt, DAY_MS } from './recurrence.js';
import { logBulk, undoBatch } from './careEventService.js';
import { uuid } from '../utils/uuid.js';
import { bus } from '../hooks/bus.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const taskRepository = new Repository(STORES.tasks);

/** @param {object} input @returns {Promise<object>} the created task */
export async function createTask(input) {
  const body = validateTask(input);
  if (body.recurrence && !body.seriesId) {
    body.seriesId = uuid();
  }
  const task = await taskRepository.add(body);
  bus.emit('task:created', { taskId: task.id });
  return task;
}

/** @param {string} taskId @returns {Promise<object|null>} */
export function getTask(taskId) {
  return taskRepository.get(taskId);
}

/**
 * Delete one task instance (soft). Recurring series die naturally: a
 * deleted pending instance spawns nothing.
 * @param {string} taskId
 */
export async function deleteTask(taskId) {
  await taskRepository.softDelete(taskId);
  bus.emit('task:deleted', { taskId });
}

/**
 * Tasks aimed only at plants that are archived, deceased or deleted are dead
 * weight: nobody can water a plant that is gone. Tasks with no plant (custom)
 * and tasks with at least one living plant are kept.
 * @param {object[]} tasks
 * @returns {Promise<{live: object[], orphaned: object[]}>}
 */
async function splitOrphaned(tasks) {
  const ids = [...new Set(tasks.flatMap((task) => task.plantIds))];
  const plants = ids.length ? await plantRepository.getMany(ids) : [];
  const living = new Set(plants.filter((p) => p.status === 'active' || p.status === 'dormant').map((p) => p.id));
  const live = [];
  const orphaned = [];
  for (const task of tasks) {
    (task.plantIds.length === 0 || task.plantIds.some((id) => living.has(id)) ? live : orphaned).push(task);
  }
  return { live, orphaned };
}

/** @returns {Promise<object[]>} pending tasks whose plants are all gone */
export async function listOrphanedTasks() {
  const { items } = await taskRepository.query({
    index: 'status_dueAt',
    range: IDBKeyRange.bound(['pending', ''], ['pending', '￿']),
    limit: 1000,
  });
  return (await splitOrphaned(items)).orphaned;
}

/**
 * Delete every orphaned pending task (and so their recurring series).
 * @returns {Promise<number>} how many were removed
 */
export async function deleteOrphanedTasks() {
  const orphaned = await listOrphanedTasks();
  for (const task of orphaned) {
    await deleteTask(task.id);
  }
  return orphaned.length;
}

/**
 * Undo a skip: drop the spawned next occurrence and make this one pending again.
 * @param {string} taskId
 */
export async function undoSkip(taskId) {
  const task = await taskRepository.get(taskId);
  if (!task || task.status !== 'skipped') {
    throw new NotFoundError('That skip no longer exists');
  }
  if (task.spawnedTaskId) {
    const spawned = await taskRepository.get(task.spawnedTaskId);
    if (spawned?.status === 'pending') {
      await taskRepository.hardDelete(spawned.id);
    }
  }
  const restored = await taskRepository.update(taskId, { status: 'pending', spawnedTaskId: null });
  bus.emit('task:created', { taskId });
  return restored;
}

/**
 * Complete a pending task (FR-4.4): optionally auto-log the matching care
 * event for its plants, then spawn the next recurring instance.
 * @param {string} taskId
 * @param {{logCareEvent?: boolean}} [options]
 * @returns {Promise<{task: object, nextTask: object|null, batchId: string|null}>}
 */
export async function completeTask(taskId, { logCareEvent = true } = {}) {
  const task = await taskRepository.get(taskId);
  if (!task) {
    throw new NotFoundError('That task no longer exists');
  }
  if (task.status !== 'pending') {
    throw new ValidationError('Only pending tasks can be completed');
  }

  const completedAt = new Date().toISOString();
  let batchId = null;
  if (logCareEvent && task.taskType !== 'custom' && task.plantIds.length > 0) {
    ({ batchId } = await logBulk(task.plantIds, task.taskType, { occurredAt: completedAt }));
  }

  const nextTask = await spawnNext(task, completedAt);
  const updated = await taskRepository.update(taskId, {
    status: 'done',
    completedAt,
    completedEventBatchId: batchId,
    spawnedTaskId: nextTask?.id ?? null,
  });

  bus.emit('task:completed', { taskId, nextTaskId: nextTask?.id ?? null, batchId });
  return { task: updated, nextTask, batchId };
}

/**
 * Fully revert a completion: restore pending, remove the spawned instance,
 * and undo the auto-logged care events.
 * @param {string} taskId
 */
export async function undoComplete(taskId) {
  const task = await taskRepository.get(taskId);
  if (!task || task.status !== 'done') {
    throw new NotFoundError('That completion no longer exists');
  }
  if (task.spawnedTaskId) {
    const spawned = await taskRepository.get(task.spawnedTaskId);
    if (spawned?.status === 'pending') {
      await taskRepository.hardDelete(spawned.id);
    }
  }
  if (task.completedEventBatchId) {
    await undoBatch(task.completedEventBatchId);
  }
  const restored = await taskRepository.update(taskId, {
    status: 'pending',
    completedAt: null,
    completedEventBatchId: null,
    spawnedTaskId: null,
  });
  bus.emit('task:created', { taskId }); // it is pending again
  return restored;
}

/**
 * Skip this occurrence without logging anything; the series continues.
 * @param {string} taskId
 * @returns {Promise<{task: object, nextTask: object|null}>}
 */
export async function skipOccurrence(taskId) {
  const task = await taskRepository.get(taskId);
  if (!task) {
    throw new NotFoundError('That task no longer exists');
  }
  if (task.status !== 'pending') {
    throw new ValidationError('Only pending tasks can be skipped');
  }
  const nextTask = await spawnNext(task, new Date().toISOString());
  const updated = await taskRepository.update(taskId, {
    status: 'skipped',
    spawnedTaskId: nextTask?.id ?? null,
  });
  bus.emit('task:skipped', { taskId, nextTaskId: nextTask?.id ?? null });
  return { task: updated, nextTask };
}

/** @param {object} task @param {string} completedAt @returns {Promise<object|null>} */
async function spawnNext(task, completedAt) {
  if (!task.recurrence) {
    return null;
  }
  const nextDueAt = computeNextDueAt(task.dueAt, task.recurrence, { completedAt });
  if (!nextDueAt) {
    return null; // series reached its end date
  }
  return taskRepository.add(validateTask({
    ...task,
    dueAt: nextDueAt,
    status: 'pending',
    completedAt: null,
    completedEventBatchId: null,
    spawnedTaskId: null,
  }));
}

/**
 * The task inbox (FR-4.3), bucketed for display.
 * @param {Date} [now]
 * @returns {Promise<{overdue: object[], dueToday: object[], upcoming: object[],
 *                    later: object[], dueCount: number}>}
 */
export async function getInbox(now = new Date()) {
  const { items } = await taskRepository.query({
    index: 'status_dueAt',
    range: IDBKeyRange.bound(['pending', ''], ['pending', '￿']),
    limit: 500,
  });

  const { live: tasks } = await splitOrphaned(items);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + DAY_MS);
  const weekAhead = new Date(startOfToday.getTime() + 8 * DAY_MS);

  const inbox = { overdue: [], dueToday: [], upcoming: [], later: [] };
  for (const task of tasks) {
    const due = Date.parse(task.dueAt);
    if (due < startOfToday.getTime()) {
      inbox.overdue.push(task);
    } else if (due < startOfTomorrow.getTime()) {
      inbox.dueToday.push(task);
    } else if (due < weekAhead.getTime()) {
      inbox.upcoming.push(task);
    } else {
      inbox.later.push(task);
    }
  }
  inbox.dueCount = inbox.overdue.length + inbox.dueToday.length;
  return inbox;
}

/**
 * Pending + done tasks of one calendar month, keyed by local date
 * (calendar view, FR-4.3).
 * @param {number} year @param {number} month 1–12
 * @returns {Promise<Record<string, object[]>>}
 */
export async function getCalendar(year, month) {
  const from = new Date(year, month - 1, 1).toISOString();
  const to = new Date(year, month, 1).toISOString();
  const { items } = await taskRepository.query({
    index: 'dueAt',
    range: IDBKeyRange.bound(from, to, false, true),
    limit: 1000,
  });

  const { live } = await splitOrphaned(items.filter((task) => task.status === 'pending'));
  const shown = new Set(live.map((task) => task.id));
  const byDate = {};
  for (const task of items.filter((t) => t.status !== 'pending' || shown.has(t.id))) {
    const d = new Date(task.dueAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    (byDate[key] ??= []).push(task);
  }
  return byDate;
}

/** Task types offered in the creation dialog: care types + custom. */
export const TASK_TYPE_OPTIONS = Object.freeze([
  ['custom', 'Custom'],
  ...Object.entries(EVENT_TYPES)
    .filter(([, spec]) => spec.quickLog || spec.derivedField)
    .map(([key, spec]) => [key, spec.label]),
]);
