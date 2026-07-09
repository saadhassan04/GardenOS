/**
 * Treatment service (Business layer, L3) — FR-10.2/10.3, T-038.
 * Treatments stamp plant timelines like every other care action, and their
 * recorded outcomes power the "what worked for X last time" query.
 */

import { validateTreatment } from '../models/Treatment.js';
import { TREATMENT_OUTCOMES } from '../models/Treatment.js';
import { Repository } from '../database/Repository.js';
import { STORES } from '../database/stores.js';
import { logBulk } from './careEventService.js';
import { listPestHistory } from './pestService.js';
import { bus } from '../hooks/bus.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const treatmentRepository = new Repository(STORES.treatments);

/**
 * Apply a treatment: record + timeline events on every treated plant.
 * @param {object} input {plantIds, product, type, dose?, method?, pestRecordId?, notes?}
 * @returns {Promise<object>} the treatment record
 */
export async function applyTreatment(input) {
  const treatment = await treatmentRepository.add(validateTreatment(input));
  await logBulk(treatment.plantIds, 'treatment', {
    occurredAt: treatment.appliedAt,
    data: { treatmentId: treatment.id, product: treatment.product, treatmentType: treatment.type },
  });
  bus.emit('treatment:applied', { treatmentId: treatment.id });
  return treatment;
}

/**
 * Note how a treatment worked out — this is what makes history useful
 * (FR-10.2).
 * @param {string} treatmentId
 * @param {'effective'|'partial'|'ineffective'} outcome
 */
export async function recordOutcome(treatmentId, outcome) {
  if (!TREATMENT_OUTCOMES.includes(outcome)) {
    throw new ValidationError(`Unknown treatment outcome "${outcome}"`);
  }
  const treatment = await treatmentRepository.get(treatmentId);
  if (!treatment) {
    throw new NotFoundError('That treatment no longer exists');
  }
  const updated = await treatmentRepository.update(treatmentId, {
    outcome,
    outcomeNotedAt: new Date().toISOString(),
  });
  bus.emit('treatment:outcome', { treatmentId, outcome });
  return updated;
}

/**
 * Treatments attached to one pest record, newest first.
 * @param {string} pestRecordId
 * @returns {Promise<object[]>}
 */
export async function listTreatmentsForPest(pestRecordId) {
  const { items } = await treatmentRepository.query({
    index: 'pestRecordId',
    range: IDBKeyRange.only(pestRecordId),
    limit: 100,
  });
  return items.sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
}

/**
 * "What cured this last time?" (FR-10.3): treatments across ALL past
 * records of a pest type that were noted effective (or partially so),
 * most recent first.
 * @param {string} pestType
 * @returns {Promise<object[]>}
 */
export async function whatWorkedFor(pestType) {
  const history = await listPestHistory(pestType);
  const treatments = [];
  for (const record of history) {
    treatments.push(...await listTreatmentsForPest(record.id));
  }
  return treatments
    .filter((t) => t.outcome === 'effective' || t.outcome === 'partial')
    .sort((a, b) => {
      if (a.outcome !== b.outcome) {
        return a.outcome === 'effective' ? -1 : 1; // effective before partial
      }
      return b.appliedAt.localeCompare(a.appliedAt);
    });
}
