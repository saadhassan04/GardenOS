/**
 * Task scheduler integration tests — v1.5: recurrence engine edge cases
 * (month-end clamp, weekly scan, seasonal rollover, end dates), the
 * complete → auto-log → spawn flow with full undo, skip, inbox bucketing,
 * and care-profile suggestions.
 */

import { test, assert, assertEqual, assertThrows } from './testKit.js';
import { STORES } from '../database/stores.js';
import { Repository } from '../database/Repository.js';
import { computeNextDueAt } from '../services/recurrence.js';
import {
  createTask,
  getTask,
  completeTask,
  undoComplete,
  skipOccurrence,
  getInbox,
  getCalendar,
  suggestFromCareProfiles,
  createSuggestedTask,
} from '../services/taskSchedulerService.js';
import { createPlant, getPlant, updatePlant } from '../services/plantService.js';
import { logEvent, getTimeline } from '../services/careEventService.js';
import { ValidationError } from '../utils/errors.js';

const DAY_MS = 86_400_000;

async function clearTasks() {
  await new Repository(STORES.tasks).clearAll();
}

function localISO(y, m, d, h = 9) {
  return new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
}

test('should compute next occurrences across every recurrence pattern', () => {
  const due = localISO(2026, 7, 10);

  // Care cadence: counts from completion, keeps the due time-of-day.
  const nextDaily = computeNextDueAt(due, { pattern: 'daily' }, { completedAt: localISO(2026, 7, 15, 18) });
  assertEqual(nextDaily, localISO(2026, 7, 16), 'daily counts from completion at the due hour');

  const nextN = computeNextDueAt(due, { pattern: 'everyNDays', interval: 3 }, { completedAt: localISO(2026, 7, 10, 11) });
  assertEqual(nextN, localISO(2026, 7, 13), 'everyNDays counts from completion');

  // Calendar schedules: from the schedule, rolled past "now".
  const friday = localISO(2026, 7, 10); // 2026-07-10 is a Friday
  const nextWeekly = computeNextDueAt(friday, { pattern: 'weekly', daysOfWeek: [5] }, { now: new Date(friday) });
  assertEqual(nextWeekly, localISO(2026, 7, 17), 'weekly lands on the next matching weekday');

  const monthEnd = computeNextDueAt(localISO(2027, 1, 31), { pattern: 'monthly' }, { now: new Date(localISO(2027, 1, 31)) });
  assertEqual(monthEnd, localISO(2027, 2, 28), 'monthly clamps Jan 31 to Feb 28 (non-leap)');

  const lateCompletion = computeNextDueAt(localISO(2026, 5, 15), { pattern: 'monthly' }, { now: new Date(localISO(2026, 7, 20)) });
  assertEqual(lateCompletion, localISO(2026, 8, 15), 'monthly rolls forward past now, never spawning overdue');

  const seasonal = computeNextDueAt(localISO(2026, 7, 1), { pattern: 'seasonal', season: 'monsoon' }, { now: new Date(localISO(2026, 7, 2)) });
  assertEqual(seasonal, localISO(2027, 7, 1), 'seasonal recurs at next year\'s season start');

  const ended = computeNextDueAt(due, { pattern: 'daily', endAt: localISO(2026, 7, 12) }, { completedAt: localISO(2026, 7, 14) });
  assertEqual(ended, null, 'series must stop at endAt');
});

test('should validate tasks and recurrences when creating', async () => {
  await clearTasks();
  await assertThrows(() => createTask({ dueAt: localISO(2026, 8, 1) }), ValidationError);
  await assertThrows(() => createTask({ title: 'X', dueAt: 'nonsense' }), ValidationError);
  await assertThrows(
    () => createTask({ title: 'X', dueAt: localISO(2026, 8, 1), recurrence: { pattern: 'hourly' } }),
    ValidationError,
  );
  await assertThrows(
    () => createTask({ title: 'X', dueAt: localISO(2026, 8, 1), recurrence: { pattern: 'weekly', daysOfWeek: [] } }),
    ValidationError,
  );

  const task = await createTask({
    title: 'Fertilize roses',
    taskType: 'fertilizing',
    dueAt: localISO(2026, 8, 1),
    recurrence: { pattern: 'everyNDays', interval: 30 },
  });
  assert(task.seriesId, 'recurring tasks must get a seriesId');
  assertEqual(task.status, 'pending');
});

test('should complete with auto-logged events, spawn the next, and undo it all', async () => {
  await clearTasks();
  const plant = await createPlant({ name: 'Task Test Rose' });
  const task = await createTask({
    title: 'Fertilize task rose',
    taskType: 'fertilizing',
    plantIds: [plant.id],
    dueAt: new Date(Date.now() - 2 * DAY_MS).toISOString(),
    recurrence: { pattern: 'everyNDays', interval: 30 },
  });

  const { task: done, nextTask, batchId } = await completeTask(task.id);
  assertEqual(done.status, 'done');
  assert(batchId, 'care-type task with plants must log events');
  assert(nextTask && nextTask.status === 'pending', 'recurring completion must spawn the next instance');
  assertEqual(nextTask.seriesId, task.seriesId, 'the series id must carry over');
  assertEqual(done.spawnedTaskId, nextTask.id);

  const plantAfter = await getPlant(plant.id);
  assert(plantAfter.derived.lastFertilizedAt, 'derived cache must update from the auto-log');
  const events = await getTimeline(plant.id, { types: ['fertilizing'], limit: 5 });
  assertEqual(events.items.length, 1);

  await completeTask(nextTask.id); // completing the spawned one works too
  await assertThrows(() => completeTask(task.id), ValidationError, 'done tasks cannot re-complete');

  // Undo the FIRST completion: pending again, spawned instance gone, events gone.
  await undoComplete(task.id);
  const restored = await getTask(task.id);
  assertEqual(restored.status, 'pending');
  assertEqual(restored.spawnedTaskId, null);
  const eventsAfterUndo = await getTimeline(plant.id, { types: ['fertilizing'], limit: 5 });
  assertEqual(eventsAfterUndo.items.length, 1, 'only the first completion\'s events must revert');
});

test('should skip occurrences without logging and keep the series alive', async () => {
  await clearTasks();
  const task = await createTask({
    title: 'Weekly balcony sweep',
    dueAt: new Date().toISOString(),
    recurrence: { pattern: 'daily' },
  });
  const { task: skipped, nextTask } = await skipOccurrence(task.id);
  assertEqual(skipped.status, 'skipped');
  assert(nextTask, 'skip must spawn the next occurrence');
  await assertThrows(() => skipOccurrence(task.id), ValidationError);
});

test('should bucket the inbox and key the calendar by local day', async () => {
  await clearTasks();
  await createTask({ title: 'Ancient', dueAt: new Date(Date.now() - 3 * DAY_MS).toISOString() });
  await createTask({ title: 'Today task', dueAt: new Date().toISOString() });
  await createTask({ title: 'Soon', dueAt: new Date(Date.now() + 3 * DAY_MS).toISOString() });
  await createTask({ title: 'Far', dueAt: new Date(Date.now() + 30 * DAY_MS).toISOString() });

  const inbox = await getInbox();
  assertEqual(inbox.overdue.map((t) => t.title), ['Ancient']);
  assertEqual(inbox.dueToday.map((t) => t.title), ['Today task']);
  assertEqual(inbox.upcoming.map((t) => t.title), ['Soon']);
  assertEqual(inbox.later.map((t) => t.title), ['Far']);
  assertEqual(inbox.dueCount, 2);

  const now = new Date();
  const calendar = await getCalendar(now.getFullYear(), now.getMonth() + 1);
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  assert(calendar[todayKey]?.some((t) => t.title === 'Today task'), 'calendar must key today correctly');
});

test('should suggest fertilizing tasks from care profiles and stop once created', async () => {
  await clearTasks();
  const plant = await createPlant({ name: 'Suggestion Palm' });
  await updatePlant(plant.id, { careOverrides: { fertilizeEveryDays: 45 } });
  await logEvent(plant.id, 'fertilizing', { occurredAt: new Date(Date.now() - 10 * DAY_MS).toISOString() });

  const suggestions = await suggestFromCareProfiles();
  const mine = suggestions.find((s) => s.plant.id === plant.id);
  assert(mine, 'override cadence must produce a suggestion');
  assertEqual(mine.everyDays, 45);

  const created = await createSuggestedTask(mine);
  assertEqual(created.taskType, 'fertilizing');
  assertEqual(created.recurrence.interval, 45);
  assert(Date.parse(created.dueAt) > Date.now(), 'first due lands one cadence after the last fertilizing');

  const after = await suggestFromCareProfiles();
  assert(!after.some((s) => s.plant.id === plant.id), 'a pending task must silence the suggestion');
});
