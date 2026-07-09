/**
 * Pest service (Business layer, L3) — FR-10, T-038.
 * Pest records integrate with the event-sourced history: observing a pest
 * also logs a pest-observation event on each affected plant's timeline.
 */

import { validatePestRecord } from '../models/PestRecord.js';
import { Repository } from '../database/Repository.js';
import { STORES } from '../database/stores.js';
import { logBulk } from './careEventService.js';
import { bus } from '../hooks/bus.js';
import { NotFoundError } from '../utils/errors.js';

const pestRepository = new Repository(STORES.pestRecords);

/**
 * Record a pest/disease observation and stamp every affected plant's
 * timeline (FR-10.1).
 * @param {object} input {pestType, plantIds, severity, notes, observedAt?}
 * @returns {Promise<object>} the pest record
 */
export async function observePest(input) {
  const record = await pestRepository.add(validatePestRecord(input));
  await logBulk(record.plantIds, 'pest-observation', {
    occurredAt: record.observedAt,
    data: { pestRecordId: record.id, pestType: record.pestType, severity: record.severity },
  });
  bus.emit('pest:observed', { pestRecordId: record.id, pestType: record.pestType });
  return record;
}

/**
 * Close a pest record (FR-10.2 outcome side).
 * @param {string} pestRecordId
 */
export async function resolvePest(pestRecordId) {
  const record = await pestRepository.get(pestRecordId);
  if (!record) {
    throw new NotFoundError('That pest record no longer exists');
  }
  const updated = await pestRepository.update(pestRecordId, {
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
  });
  bus.emit('pest:resolved', { pestRecordId });
  return updated;
}

/** @returns {Promise<object[]>} unresolved records, newest observation first */
export async function listActivePests() {
  const { items } = await pestRepository.query({
    index: 'status',
    range: IDBKeyRange.only('active'),
    limit: 200,
  });
  const { items: monitoring } = await pestRepository.query({
    index: 'status',
    range: IDBKeyRange.only('monitoring'),
    limit: 200,
  });
  return [...items, ...monitoring].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}

/**
 * Unresolved pest records affecting one plant (detail page section).
 * @param {string} plantId
 * @returns {Promise<object[]>}
 */
export async function listActivePestsForPlant(plantId) {
  const { items } = await pestRepository.query({
    index: 'plantIds',
    range: IDBKeyRange.only(plantId),
    limit: 200,
  });
  return items
    .filter((record) => record.status !== 'resolved')
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}

/**
 * Every record of one pest type, newest first — the history behind
 * "what cured mealybugs last time?" (FR-10.3).
 * @param {string} pestType
 * @returns {Promise<object[]>}
 */
export async function listPestHistory(pestType) {
  const { items } = await pestRepository.query({
    index: 'pestType',
    range: IDBKeyRange.only(pestType.trim().toLowerCase()),
    limit: 200,
  });
  return items.sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}
