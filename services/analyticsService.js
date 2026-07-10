/**
 * Analytics service (Business layer, L3) — API_DESIGN.md §2, FR-8, T-072.
 * First-generation analytics over the event-sourced history: garden-wide
 * stats and daily activity series that feed the dashboard charts.
 */

import { plantRepository } from '../database/PlantRepository.js';
import { eventRepository } from '../database/EventRepository.js';
import { listNotes } from './notesService.js';
import { listBatches } from './kitchenGardenService.js';
import { getStorageStats } from './imageService.js';

const DAY_MS = 86_400_000;

/**
 * Headline numbers for the stats widget (FR-8.1).
 * @returns {Promise<{plantsActive: number, eventsLogged: number,
 *                    photos: number, notes: number, activeBatches: number}>}
 */
export async function gardenStats() {
  const [active, photos, notes, batches, eventsLogged] = await Promise.all([
    plantRepository.listByStatus('active'),
    getStorageStats(),
    listNotes(),
    listBatches(),
    eventRepository.count(),
  ]);
  return {
    plantsActive: active.length,
    eventsLogged,
    photos: photos.count,
    notes: notes.length,
    activeBatches: batches.length,
  };
}

/**
 * Daily counts of one event type over a trailing window (watering chart).
 * Every day in the window is present, zero-filled — charts need the gaps.
 * @param {{type?: string, days?: number, until?: Date}} [options]
 * @returns {Promise<{date: string, count: number}[]>} oldest → newest
 */
export async function dailyEventCounts({ type = 'watering', days = 14, until = new Date() } = {}) {
  const to = endOfDayISO(until);
  const from = new Date(until.getTime() - (days - 1) * DAY_MS);
  const fromISO = startOfDayISO(from);

  const { items } = await eventRepository.query({
    index: 'type_occurredAt',
    range: IDBKeyRange.bound([type, fromISO], [type, to]),
    limit: 10_000,
  });

  return zeroFilledSeries(from, days, items);
}

/**
 * Daily counts of ALL care events (activity heatmap).
 * @param {{days?: number, until?: Date}} [options]
 * @returns {Promise<{date: string, count: number}[]>} oldest → newest
 */
export async function dailyActivity({ days = 84, until = new Date() } = {}) {
  const from = new Date(until.getTime() - (days - 1) * DAY_MS);
  const { items } = await eventRepository.query({
    index: 'occurredAt',
    range: IDBKeyRange.bound(startOfDayISO(from), endOfDayISO(until)),
    limit: 10_000,
  });
  return zeroFilledSeries(from, days, items);
}

function zeroFilledSeries(from, days, events) {
  const counts = new Map();
  for (let i = 0; i < days; i += 1) {
    counts.set(localDateKey(new Date(from.getTime() + i * DAY_MS)), 0);
  }
  for (const event of events) {
    const key = localDateKey(new Date(event.occurredAt));
    if (counts.has(key)) {
      counts.set(key, counts.get(key) + 1);
    }
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count }));
}

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDayISO(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfDayISO(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
