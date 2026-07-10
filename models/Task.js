/**
 * Task model (Data layer, L2) — DATABASE.md §3.3, FR-4.
 * One-off and recurring tasks. Recurring instances share a seriesId; the
 * completed instance remembers the care events it logged
 * (completedEventBatchId) and the instance it spawned (spawnedTaskId) so
 * completion is fully undoable.
 */

import { ValidationError } from '../utils/errors.js';
import { EVENT_TYPES } from '../config/registries.js';
import { CARE_SEASONS } from '../config/climate.karachi.js';

export const RECURRENCE_PATTERNS = Object.freeze([
  'daily',
  'everyNDays',
  'weekly',
  'monthly',
  'seasonal',
]);

export const TASK_STATUSES = Object.freeze(['pending', 'done', 'skipped']);

/**
 * @param {object} input
 * @returns {object} complete task body (envelope excluded)
 * @throws {ValidationError}
 */
export function validateTask(input) {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Task input must be an object');
  }

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) {
    throw new ValidationError('A task needs a title');
  }

  const taskType = input.taskType ?? 'custom';
  if (taskType !== 'custom' && !(taskType in EVENT_TYPES)) {
    throw new ValidationError(`Unknown task type "${taskType}"`);
  }

  const dueAt = input.dueAt;
  if (!dueAt || Number.isNaN(Date.parse(dueAt))) {
    throw new ValidationError('A task needs a valid due date');
  }

  const status = input.status ?? 'pending';
  if (!TASK_STATUSES.includes(status)) {
    throw new ValidationError(`Unknown task status "${status}"`);
  }

  return {
    title,
    taskType,
    plantIds: Array.isArray(input.plantIds)
      ? input.plantIds.filter((id) => typeof id === 'string' && id.length > 0)
      : [],
    locationId: input.locationId ?? null,
    dueAt: new Date(dueAt).toISOString(),
    recurrence: validateRecurrence(input.recurrence ?? null),
    status,
    completedAt: input.completedAt ?? null,
    completedEventBatchId: input.completedEventBatchId ?? null,
    spawnedTaskId: input.spawnedTaskId ?? null,
    seriesId: input.seriesId ?? null,
    notes: (input.notes ?? '').trim(),
  };
}

/**
 * @param {object|null} recurrence
 * @returns {object|null} normalized recurrence
 * @throws {ValidationError}
 */
export function validateRecurrence(recurrence) {
  if (recurrence === null) {
    return null;
  }
  const { pattern } = recurrence;
  if (!RECURRENCE_PATTERNS.includes(pattern)) {
    throw new ValidationError(`Unknown recurrence pattern "${pattern}"`);
  }

  const normalized = { pattern, interval: null, daysOfWeek: null, season: null, endAt: null };

  if (pattern === 'everyNDays') {
    if (!Number.isInteger(recurrence.interval) || recurrence.interval < 1) {
      throw new ValidationError('Repeat interval must be a whole number of days (≥ 1)');
    }
    normalized.interval = recurrence.interval;
  }
  if (pattern === 'weekly') {
    const days = Array.isArray(recurrence.daysOfWeek)
      ? [...new Set(recurrence.daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
      : [];
    if (days.length === 0) {
      throw new ValidationError('Weekly tasks need at least one weekday (0=Sunday … 6=Saturday)');
    }
    normalized.daysOfWeek = days;
  }
  if (pattern === 'seasonal') {
    if (!(recurrence.season in CARE_SEASONS)) {
      throw new ValidationError(`Unknown season "${recurrence.season}"`);
    }
    normalized.season = recurrence.season;
  }
  if (recurrence.endAt != null) {
    if (Number.isNaN(Date.parse(recurrence.endAt))) {
      throw new ValidationError('Recurrence end date is not a valid date');
    }
    normalized.endAt = new Date(recurrence.endAt).toISOString();
  }
  return normalized;
}
