/**
 * Recurrence engine (Business layer, L3) — FR-4.1, T-080.
 * Pure date math, no storage. All arithmetic uses LOCAL calendar methods
 * (setDate/setMonth handle DST shifts where they exist), and the produced
 * occurrence keeps the original due time-of-day.
 *
 * Scheduling policy (encoded in tests):
 * - daily / everyNDays are CARE CADENCE: the next occurrence counts from
 *   the completion date (water-every-2-days completed 5 days late means
 *   next watering is 2 days from now, not 3 days ago).
 * - weekly / monthly / seasonal are CALENDAR schedules: the next occurrence
 *   follows the schedule from the original due date, rolled forward past
 *   "now" so a late completion never spawns an already-overdue instance.
 */

import { CARE_SEASONS } from '../config/climate.karachi.js';

const DAY_MS = 86_400_000;
const SAFETY_LIMIT = 400; // scan bound: no pattern needs more than ~366 steps

/**
 * The next occurrence for a recurring task, or null when the series ends.
 * @param {string} dueAtISO the completed instance's due timestamp
 * @param {object} recurrence a validated recurrence (models/Task.js)
 * @param {{completedAt?: string, now?: Date}} [options]
 * @returns {string|null} ISO timestamp of the next instance's dueAt
 */
export function computeNextDueAt(dueAtISO, recurrence, { completedAt = null, now = new Date() } = {}) {
  const due = new Date(dueAtISO);
  let next;

  switch (recurrence.pattern) {
    case 'daily':
    case 'everyNDays': {
      const interval = recurrence.pattern === 'daily' ? 1 : recurrence.interval;
      const base = completedAt ? new Date(completedAt) : due;
      next = new Date(base);
      next.setDate(next.getDate() + interval);
      applyTimeOfDay(next, due);
      break;
    }
    case 'weekly': {
      const days = new Set(recurrence.daysOfWeek);
      const base = laterOf(due, now);
      next = new Date(base);
      applyTimeOfDay(next, due);
      for (let i = 0; i < SAFETY_LIMIT; i += 1) {
        next.setDate(next.getDate() + 1);
        if (days.has(next.getDay())) {
          break;
        }
      }
      break;
    }
    case 'monthly': {
      const dayOfMonth = due.getDate();
      const base = laterOf(due, now);
      next = new Date(base);
      for (let i = 0; i < 24; i += 1) {
        // First day of the following month, then clamp to the target day
        // (Jan 31 → Feb 28): setDate on day 0 of month+2 yields month end.
        next = new Date(next.getFullYear(), next.getMonth() + 1, 1);
        const monthEnd = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth, monthEnd));
        applyTimeOfDay(next, due);
        if (next.getTime() > base.getTime()) {
          break;
        }
      }
      break;
    }
    case 'seasonal': {
      const firstMonth = CARE_SEASONS[recurrence.season][0]; // 1–12
      const base = laterOf(due, now);
      next = new Date(base.getFullYear(), firstMonth - 1, 1);
      applyTimeOfDay(next, due);
      while (next.getTime() <= base.getTime()) {
        next = new Date(next.getFullYear() + 1, firstMonth - 1, 1);
        applyTimeOfDay(next, due);
      }
      break;
    }
    default:
      return null;
  }

  if (recurrence.endAt && next.getTime() > Date.parse(recurrence.endAt)) {
    return null;
  }
  return next.toISOString();
}

function applyTimeOfDay(target, source) {
  target.setHours(source.getHours(), source.getMinutes(), 0, 0);
}

function laterOf(a, b) {
  return a.getTime() >= b.getTime() ? a : b;
}

/** Human label for a recurrence, for task rows and dialogs. */
export function describeRecurrence(recurrence) {
  if (!recurrence) {
    return '';
  }
  switch (recurrence.pattern) {
    case 'daily': return 'daily';
    case 'everyNDays': return `every ${recurrence.interval} days`;
    case 'weekly': return 'weekly';
    case 'monthly': return 'monthly';
    case 'seasonal': return `every ${recurrence.season}`;
    default: return '';
  }
}

/** Milliseconds in a day — shared by inbox bucketing. */
export { DAY_MS };
