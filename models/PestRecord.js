/**
 * Pest/disease record model (Data layer, L2) — DATABASE.md §3.9, FR-10.1.
 * Pest types are free text (lowercased for matching) — the registry approach
 * would fight reality; gardens invent new problems.
 */

import { ValidationError } from '../utils/errors.js';

export const PEST_SEVERITIES = Object.freeze(['low', 'medium', 'high']);
export const PEST_STATUSES = Object.freeze(['active', 'monitoring', 'resolved']);

/** Common Karachi garden pests — datalist suggestions, not a constraint. */
export const COMMON_PESTS = Object.freeze([
  'mealybug', 'aphid', 'spider mite', 'whitefly', 'scale', 'caterpillar',
  'leaf miner', 'plumeria rust', 'powdery mildew', 'fungal leaf spot',
  'root rot', 'sooty mold',
]);

/**
 * @param {object} input
 * @returns {object} complete pest record body (envelope excluded)
 * @throws {ValidationError}
 */
export function validatePestRecord(input) {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Pest record input must be an object');
  }

  const pestType = typeof input.pestType === 'string' ? input.pestType.trim().toLowerCase() : '';
  if (!pestType) {
    throw new ValidationError('Name the pest or disease (e.g. "mealybug")');
  }

  const plantIds = Array.isArray(input.plantIds)
    ? input.plantIds.filter((id) => typeof id === 'string' && id.length > 0)
    : [];
  if (plantIds.length === 0) {
    throw new ValidationError('A pest record needs at least one affected plant');
  }

  const severity = input.severity ?? 'medium';
  if (!PEST_SEVERITIES.includes(severity)) {
    throw new ValidationError(`Unknown severity "${severity}"`);
  }

  const status = input.status ?? 'active';
  if (!PEST_STATUSES.includes(status)) {
    throw new ValidationError(`Unknown pest status "${status}"`);
  }

  const observedAt = input.observedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(observedAt))) {
    throw new ValidationError('Observed date is not a valid timestamp');
  }

  return {
    pestType,
    plantIds,
    severity,
    status,
    observedAt: new Date(observedAt).toISOString(),
    resolvedAt: input.resolvedAt ?? null,
    imageIds: Array.isArray(input.imageIds) ? input.imageIds : [],
    notes: (input.notes ?? '').trim(),
  };
}
