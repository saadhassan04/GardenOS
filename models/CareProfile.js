/**
 * Care profile model (Data layer, L2) — DATABASE.md §3.12, FR-1.3.
 * Reusable care templates per species; plants reference one and may
 * override individual values (plants.careOverrides).
 */

import { ValidationError } from '../utils/errors.js';

const SEASON_KEYS = ['summer', 'monsoon', 'winter'];

/**
 * @param {object} input
 * @returns {object} complete care profile body (envelope excluded)
 * @throws {ValidationError}
 */
export function validateCareProfile(input) {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Care profile input must be an object');
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw new ValidationError('A care profile needs a name');
  }

  const checkDays = (value, label) => {
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      throw new ValidationError(`${label} must be a positive number of days`);
    }
    return value;
  };

  let wateringSeasonal = input.wateringSeasonal ?? null;
  if (wateringSeasonal !== null) {
    wateringSeasonal = Object.fromEntries(
      SEASON_KEYS.map((season) => [
        season,
        checkDays(wateringSeasonal[season] ?? null, `Watering (${season})`),
      ]),
    );
  }

  return {
    name,
    species: (input.species ?? '').trim(),
    wateringEveryDays: checkDays(input.wateringEveryDays ?? null, 'Watering interval'),
    wateringSeasonal,
    fertilizeEveryDays: checkDays(input.fertilizeEveryDays ?? null, 'Fertilizing interval'),
    fertilizer: (input.fertilizer ?? '').trim(),
    repotEveryMonths: input.repotEveryMonths ?? null,
    pruningNotes: (input.pruningNotes ?? '').trim(),
    seasonalNotes: {
      heatWave: (input.seasonalNotes?.heatWave ?? '').trim(),
      monsoon: (input.seasonalNotes?.monsoon ?? '').trim(),
    },
    source: input.source === 'seed' ? 'seed' : 'user',
  };
}
