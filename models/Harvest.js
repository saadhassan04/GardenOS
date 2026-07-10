/**
 * Harvest model (Data layer, L2) — DATABASE.md §3.8, FR-5.3.
 * A harvest belongs to a sowing batch (annual vegetables) and/or a plant
 * (perennials like curry leaf and lemon); crop is always recorded so yield
 * analytics never need a join.
 */

import { ValidationError } from '../utils/errors.js';

export const HARVEST_UNITS = Object.freeze(['kg', 'g', 'count', 'bunch']);
export const HARVEST_QUALITIES = Object.freeze(['excellent', 'good', 'fair', 'poor']);

/**
 * @param {object} input
 * @returns {object} complete harvest body (envelope excluded)
 * @throws {ValidationError}
 */
export function validateHarvest(input) {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Harvest input must be an object');
  }

  const crop = typeof input.crop === 'string' ? input.crop.trim() : '';
  if (!crop) {
    throw new ValidationError('A harvest needs a crop name');
  }

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new ValidationError('Harvest quantity must be a positive number');
  }

  const unit = input.unit ?? 'count';
  if (!HARVEST_UNITS.includes(unit)) {
    throw new ValidationError(`Unknown harvest unit "${unit}"`);
  }

  const quality = input.quality ?? null;
  if (quality !== null && !HARVEST_QUALITIES.includes(quality)) {
    throw new ValidationError(`Unknown harvest quality "${quality}"`);
  }

  const harvestedAt = input.harvestedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(harvestedAt))) {
    throw new ValidationError('Harvest date is not a valid date');
  }
  if (Date.parse(harvestedAt) > Date.now() + 60_000) {
    throw new ValidationError('Harvest date cannot be in the future');
  }

  return {
    sowingBatchId: input.sowingBatchId ?? null,
    plantId: input.plantId ?? null,
    crop,
    harvestedAt: new Date(harvestedAt).toISOString(),
    quantity: input.quantity,
    unit,
    quality,
    notes: (input.notes ?? '').trim(),
  };
}
