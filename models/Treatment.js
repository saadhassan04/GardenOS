/**
 * Treatment model (Data layer, L2) — DATABASE.md §3.10, FR-10.2.
 * A treatment records what was applied and — crucially for "what worked
 * last time" — its outcome, noted later.
 */

import { ValidationError } from '../utils/errors.js';

export const TREATMENT_TYPES = Object.freeze(['organic', 'chemical', 'cultural']);
export const TREATMENT_OUTCOMES = Object.freeze(['effective', 'partial', 'ineffective']);

/**
 * @param {object} input
 * @returns {object} complete treatment body (envelope excluded)
 * @throws {ValidationError}
 */
export function validateTreatment(input) {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Treatment input must be an object');
  }

  const product = typeof input.product === 'string' ? input.product.trim() : '';
  if (!product) {
    throw new ValidationError('Name the treatment product (e.g. "Neem oil")');
  }

  const plantIds = Array.isArray(input.plantIds)
    ? input.plantIds.filter((id) => typeof id === 'string' && id.length > 0)
    : [];
  if (plantIds.length === 0) {
    throw new ValidationError('A treatment needs at least one treated plant');
  }

  const type = input.type ?? 'organic';
  if (!TREATMENT_TYPES.includes(type)) {
    throw new ValidationError(`Unknown treatment type "${type}"`);
  }

  const outcome = input.outcome ?? null;
  if (outcome !== null && !TREATMENT_OUTCOMES.includes(outcome)) {
    throw new ValidationError(`Unknown treatment outcome "${outcome}"`);
  }

  const appliedAt = input.appliedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(appliedAt))) {
    throw new ValidationError('Applied date is not a valid timestamp');
  }

  return {
    pestRecordId: input.pestRecordId ?? null,
    plantIds,
    product,
    type,
    dose: (input.dose ?? '').trim(),
    method: (input.method ?? '').trim(),
    appliedAt: new Date(appliedAt).toISOString(),
    outcome,
    outcomeNotedAt: input.outcomeNotedAt ?? null,
    notes: (input.notes ?? '').trim(),
  };
}
