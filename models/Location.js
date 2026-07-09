/**
 * Garden location model (Data layer, L2) — DATABASE.md §3.11.
 * Areas of the garden (balcony, rooftop, bed…). The structured `geometry`
 * field stays null until the v6.0 digital twin gives it meaning.
 */

import { ValidationError } from '../utils/errors.js';

export const LOCATION_KINDS = Object.freeze({
  'balcony': { label: 'Balcony' },
  'rooftop': { label: 'Rooftop' },
  'bed': { label: 'Garden bed' },
  'indoor-room': { label: 'Indoor room' },
  'greenhouse': { label: 'Greenhouse' },
  'other': { label: 'Other' },
});

export const SUN_PROFILES = Object.freeze({
  'full-am': { label: 'Full morning sun' },
  'full-pm': { label: 'Full afternoon sun' },
  'full-day': { label: 'Full day sun' },
  'partial': { label: 'Partial sun' },
  'shade': { label: 'Shade' },
});

/**
 * @param {object} input
 * @returns {object} complete location body (envelope excluded)
 * @throws {ValidationError}
 */
export function validateLocation(input) {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Location input must be an object');
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw new ValidationError('A location needs a name (e.g. "East Balcony")');
  }

  const kind = input.kind ?? 'other';
  if (!(kind in LOCATION_KINDS)) {
    throw new ValidationError(`Unknown location kind "${kind}"`);
  }

  const sunProfile = input.sunProfile ?? null;
  if (sunProfile !== null && !(sunProfile in SUN_PROFILES)) {
    throw new ValidationError(`Unknown sun profile "${sunProfile}"`);
  }

  return {
    name,
    kind,
    sunProfile,
    geometry: null, // reserved for the v6.0 digital twin
    notes: (input.notes ?? '').trim(),
  };
}
