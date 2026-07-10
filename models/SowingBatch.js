/**
 * Sowing batch model (Data layer, L2) — DATABASE.md §3.7, FR-5.1.
 * A batch tracks one sowing (crop + variety + quantity) through the
 * vegetable lifecycle. stageHistory is the denormalized mirror of stage
 * changes kept on the record for fast display (DATABASE.md §3.7).
 */

import { ValidationError } from '../utils/errors.js';

/** Lifecycle stages in order — forward-only transitions (FR-5.1). */
export const SOWING_STAGES = Object.freeze([
  'sown',
  'germinated',
  'transplanted',
  'flowering',
  'fruiting',
  'harvesting',
  'finished',
]);

export const STAGE_LABELS = Object.freeze({
  'sown': 'Sown',
  'germinated': 'Germinated',
  'transplanted': 'Transplanted',
  'flowering': 'Flowering',
  'fruiting': 'Fruiting',
  'harvesting': 'Harvesting',
  'finished': 'Finished',
});

/**
 * @param {object} input
 * @returns {object} complete batch body (envelope excluded)
 * @throws {ValidationError}
 */
export function validateSowingBatch(input) {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Sowing batch input must be an object');
  }

  const crop = typeof input.crop === 'string' ? input.crop.trim() : '';
  if (!crop) {
    throw new ValidationError('A sowing batch needs a crop name');
  }

  const quantity = input.quantity ?? null;
  if (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0)) {
    throw new ValidationError('Quantity must be a positive number of seeds/seedlings');
  }

  const sownAt = input.sownAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(sownAt))) {
    throw new ValidationError('Sowing date is not a valid date');
  }
  if (Date.parse(sownAt) > Date.now() + 60_000) {
    throw new ValidationError('Sowing date cannot be in the future');
  }

  const stage = input.stage ?? 'sown';
  if (!SOWING_STAGES.includes(stage)) {
    throw new ValidationError(`Unknown sowing stage "${stage}"`);
  }

  const sownAtISO = new Date(sownAt).toISOString();
  return {
    crop,
    variety: (input.variety ?? '').trim(),
    plantId: input.plantId ?? null,
    sownAt: sownAtISO,
    quantity,
    medium: (input.medium ?? '').trim(),
    locationId: input.locationId ?? null,
    stage,
    stageHistory: Array.isArray(input.stageHistory) && input.stageHistory.length > 0
      ? input.stageHistory
      : [{ stage, at: sownAtISO }],
    expectedHarvestWindow: input.expectedHarvestWindow ?? null,
  };
}
