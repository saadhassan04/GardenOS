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
import { NotFoundError } from '../utils/errors.js';

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
