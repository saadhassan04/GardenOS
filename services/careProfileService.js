/**
 * Care profile service (Business layer, L3) — FR-1.3, T-039.
 * Seeding of Karachi presets (idempotent, first run only), profile CRUD,
 * and the effective-care resolution used by freshness/task logic:
 * plant override → seasonal profile value → base profile value.
 */

import { validateCareProfile } from '../models/CareProfile.js';
import { Repository } from '../database/Repository.js';
import { plantRepository } from '../database/PlantRepository.js';
import { STORES } from '../database/stores.js';
import { KARACHI_CARE_PROFILES } from '../database/seed/careProfiles.karachi.js';
import { currentSeason } from '../config/climate.karachi.js';
import { bus } from '../hooks/bus.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const DAY_MS = 86_400_000;

const careProfileRepository = new Repository(STORES.careProfiles);

/**
 * Seed the Karachi presets exactly once (empty store = fresh install).
 * User edits are never overwritten: seeding is skipped whenever ANY
 * profile exists, seeded or user-made.
 * @returns {Promise<{seeded: number}>}
 */
export async function ensureSeededCareProfiles() {
  const existing = await careProfileRepository.count();
  if (existing > 0) {
    return { seeded: 0 };
  }
  const validated = KARACHI_CARE_PROFILES.map(validateCareProfile);
  await careProfileRepository.addMany(validated);
  logger.info(`Seeded ${validated.length} Karachi care profiles`);
  bus.emit('careProfiles:seeded', { count: validated.length });
  return { seeded: validated.length };
}

/** @returns {Promise<object[]>} all profiles, name-sorted */
export async function listCareProfiles() {
  const { items } = await careProfileRepository.query({ limit: 500 });
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/** @param {string} profileId @returns {Promise<object|null>} */
export function getCareProfile(profileId) {
  return careProfileRepository.get(profileId);
}

/** @param {object} input @returns {Promise<object>} */
export async function createCareProfile(input) {
  return careProfileRepository.add(validateCareProfile({ ...input, source: 'user' }));
}

/** @param {string} profileId @param {object} patch */
export async function updateCareProfile(profileId, patch) {
  const existing = await careProfileRepository.get(profileId);
  if (!existing) {
    throw new NotFoundError('That care profile no longer exists');
  }
  return careProfileRepository.update(
    profileId,
    validateCareProfile({ ...existing, ...patch, source: existing.source }),
  );
}

/**
 * Plants (any status) currently assigned to a profile. No dedicated index:
 * a bounded scan is fine at garden scale (DATABASE.md §6 philosophy —
 * indexes exist for measured hot paths only).
 * @param {string} profileId
 * @returns {Promise<number>}
 */
export async function countPlantsUsingProfile(profileId) {
  const { items } = await plantRepository.query({ limit: 2000 });
  return items.filter((plant) => plant.careProfileId === profileId).length;
}

/**
 * Delete a profile — refused while any plant still uses it, so plants
 * never point at a ghost (mirrors the locations rule).
 * @param {string} profileId
 */
export async function deleteCareProfile(profileId) {
  const inUse = await countPlantsUsingProfile(profileId);
  if (inUse > 0) {
    throw new ValidationError(`${inUse} plant(s) use this profile — reassign them first`);
  }
  await careProfileRepository.softDelete(profileId);
  bus.emit('careProfile:deleted', { profileId });
}

/**
 * The watering interval that applies to a plant today (FR-1.3):
 * plant override → profile seasonal value → profile base value → null.
 * @param {object} plant
 * @param {object|null} profile the plant's care profile (caller-resolved,
 *   so list views can batch-load profiles once)
 * @param {Date} [date]
 * @returns {number|null} days between waterings, null when unknown
 */
export function effectiveWateringDays(plant, profile, date = new Date()) {
  if (Number.isFinite(plant.careOverrides?.wateringEveryDays)) {
    return plant.careOverrides.wateringEveryDays;
  }
  if (!profile) {
    return null;
  }
  const season = currentSeason(date);
  return profile.wateringSeasonal?.[season] ?? profile.wateringEveryDays ?? null;
}

/**
 * One plant's watering schedule, or null when the interval is unknown —
 * unset means unset, so the caller says "no schedule" rather than inventing
 * a date (Plant Knowledge Philosophy: never guess an interval).
 *
 * `daysUntil` counts whole days to the next watering and goes negative when
 * overdue; it rounds up, so "in 1 day" means "within a day", and 0 means due
 * today. This agrees exactly with listNeedsWatering's due test at every
 * boundary because watering intervals are whole days.
 *
 * `elapsedRatio` is the fraction of the interval already spent (0 = just
 * watered, 1 = due or overdue) — the progress bar's value.
 *
 * @param {object} plant
 * @param {object|null} profile the plant's care profile (caller-resolved)
 * @param {Date} [date]
 * @returns {{everyDays: number, dueAt: string|null, daysUntil: number,
 *   elapsedRatio: number, neverWatered: boolean}|null}
 */
export function wateringSchedule(plant, profile, date = new Date()) {
  const everyDays = effectiveWateringDays(plant, profile, date);
  if (!everyDays) {
    return null;
  }
  const { neverDone, ...rest } = cycle(everyDays, plant.derived?.lastWateredAt, date);
  return { ...rest, neverWatered: neverDone };
}

/**
 * Feeding interval: plant override → profile value → null (no seasons, D5).
 * @param {object} plant @param {object|null} profile
 * @returns {number|null}
 */
export function effectiveFertilizeDays(plant, profile) {
  return plant.careOverrides?.fertilizeEveryDays ?? profile?.fertilizeEveryDays ?? null;
}

/**
 * One plant's feeding schedule (same arithmetic as watering), or null when
 * no interval is known.
 * @returns {{everyDays: number, dueAt: string|null, daysUntil: number,
 *   elapsedRatio: number, neverDone: boolean}|null}
 */
export function fertilizeSchedule(plant, profile, date = new Date()) {
  const everyDays = effectiveFertilizeDays(plant, profile);
  return everyDays ? cycle(everyDays, plant.derived?.lastFertilizedAt, date) : null;
}

/** Shared interval arithmetic: `last` ISO (or null) + every N days vs `date`. */
function cycle(everyDays, last, date) {
  if (!last) {
    // Nothing to count from — never done counts as due now.
    return { everyDays, dueAt: null, daysUntil: 0, elapsedRatio: 1, neverDone: true };
  }
  const intervalMs = everyDays * DAY_MS;
  const dueAtMs = Date.parse(last) + intervalMs;
  const elapsedMs = date.getTime() - Date.parse(last);
  return {
    everyDays,
    dueAt: new Date(dueAtMs).toISOString(),
    daysUntil: Math.ceil((dueAtMs - date.getTime()) / DAY_MS),
    elapsedRatio: Math.min(1, Math.max(0, elapsedMs / intervalMs)),
    neverDone: false,
  };
}

/**
 * Watering schedules for a whole list, keyed by plant id (values may be
 * null — see wateringSchedule). Profiles are read once for the batch:
 * effectiveWateringDays takes a caller-resolved profile precisely so list
 * views don't query per plant.
 * @param {object[]} plants
 * @param {Date} [date]
 * @returns {Promise<Map<string, object|null>>}
 */
export async function resolveWateringSchedules(plants, date = new Date()) {
  const profiles = await listCareProfiles();
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return new Map(
    plants.map((plant) => {
      const profile = plant.careProfileId ? profileById.get(plant.careProfileId) ?? null : null;
      return [plant.id, wateringSchedule(plant, profile, date)];
    }),
  );
}

/**
 * Active plants whose watering is due or overdue right now — care profile
 * (or override) vs. actual history (FR-8.1 "needs attention"). Plants with
 * no known interval are skipped: no guessing.
 * @param {Date} [date]
 * @returns {Promise<{plant: object, everyDays: number, daysSince: number|null}[]>}
 *   most-overdue first; daysSince null = never watered
 */
export async function listNeedsWatering(date = new Date()) {
  const [plants, profiles] = await Promise.all([
    plantRepository.listByStatus('active'),
    listCareProfiles(),
  ]);
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const due = [];
  for (const plant of plants) {
    const profile = plant.careProfileId ? profileById.get(plant.careProfileId) ?? null : null;
    const everyDays = effectiveWateringDays(plant, profile, date);
    if (!everyDays) {
      continue;
    }
    const last = plant.derived.lastWateredAt;
    const daysSince = last ? Math.floor((date.getTime() - Date.parse(last)) / DAY_MS) : null;
    if (daysSince === null || daysSince >= everyDays) {
      due.push({ plant, everyDays, daysSince });
    }
  }
  return due.sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity));
}
