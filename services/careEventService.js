/**
 * Care event service (Business layer, L3) — API_DESIGN.md §2, FR-2/FR-3.
 * Event-sourced care history (ARCHITECTURE.md D4): every log appends
 * immutable events, then refreshes the plants' derived caches. Every log —
 * single or bulk — carries a batchId so Undo is uniform.
 */

import { validateCareEvent } from '../models/CareEvent.js';
import { eventRepository } from '../database/EventRepository.js';
import { plantRepository } from '../database/PlantRepository.js';
import { EVENT_TYPES } from '../config/registries.js';
import { uuid } from '../utils/uuid.js';
import { bus } from '../hooks/bus.js';
import { NotFoundError } from '../utils/errors.js';

/**
 * Log one care event.
 * @param {string} plantId
 * @param {string} type EVENT_TYPES key
 * @param {{occurredAt?: string, data?: object, imageIds?: string[]}} [options]
 * @returns {Promise<{event: object, batchId: string}>}
 */
export async function logEvent(plantId, type, options = {}) {
  const result = await logBulk([plantId], type, options);
  return { event: result.events[0], batchId: result.batchId };
}

/**
 * Log the same care event for many plants at once (US-A2, FR-3.2):
 * one transaction, one shared batchId, one bus emission.
 * @param {string[]} plantIds
 * @param {string} type
 * @param {{occurredAt?: string, data?: object, imageIds?: string[]}} [options]
 * @returns {Promise<{events: object[], batchId: string}>}
 */
export async function logBulk(plantIds, type, { occurredAt, data, imageIds } = {}) {
  const batchId = uuid();
  const bodies = plantIds.map((plantId) =>
    validateCareEvent({ plantId, type, occurredAt, data, imageIds, batchId }),
  );

  const plants = await plantRepository.getMany(plantIds);
  if (plants.length !== plantIds.length) {
    throw new NotFoundError('One or more of those plants no longer exists');
  }

  const events = await eventRepository.addMany(bodies);

  for (const plant of plants) {
    const event = events.find((e) => e.plantId === plant.id);
    await applyDerivedAfterLog(plant, event);
  }

  bus.emit('events:logged', { type, plantIds: [...plantIds], batchId });
  return { events, batchId };
}

/**
 * A plant's timeline, newest first (FR-2.1).
 * @param {string} plantId
 * @param {{types?: string[]|null, limit?: number, cursor?: string|null}} [options]
 */
export function getTimeline(plantId, options = {}) {
  return eventRepository.getTimeline(plantId, options);
}

/**
 * Undo a logged batch: remove its events and recompute the derived caches
 * of every affected plant from the surviving history (API_DESIGN.md §2).
 * @param {string} batchId
 * @returns {Promise<{undone: number}>}
 */
export async function undoBatch(batchId) {
  const removed = await eventRepository.deleteByBatchId(batchId);
  const affectedPlantIds = [...new Set(removed.map((event) => event.plantId))];
  for (const plantId of affectedPlantIds) {
    await recomputeDerived(plantId);
  }
  bus.emit('events:logged', { type: 'undo', plantIds: affectedPlantIds, batchId });
  return { undone: removed.length };
}

/**
 * Refresh a plant's derived cache incrementally after a new event.
 * Backdated events never regress a "last done" timestamp.
 * @param {object} plant
 * @param {object} event
 */
async function applyDerivedAfterLog(plant, event) {
  const derivedPatch = { eventCount: plant.derived.eventCount + 1 };
  const field = EVENT_TYPES[event.type].derivedField;
  if (field) {
    const current = plant.derived[field];
    if (!current || event.occurredAt > current) {
      derivedPatch[field] = event.occurredAt;
    }
  }
  await plantRepository.updateDerived(plant.id, derivedPatch);
}

/**
 * Full derived-cache rebuild from events (undo path; also the Diagnostics
 * consistency tool later). Derived values are caches — this is the proof.
 * @param {string} plantId
 */
export async function recomputeDerived(plantId) {
  const plant = await plantRepository.get(plantId);
  if (!plant) {
    return; // plant deleted meanwhile — nothing to recompute
  }
  const derivedPatch = { eventCount: await eventRepository.countForPlant(plantId) };
  for (const [type, spec] of Object.entries(EVENT_TYPES)) {
    if (spec.derivedField) {
      const last = await eventRepository.lastOfType(plantId, type);
      derivedPatch[spec.derivedField] = last?.occurredAt ?? null;
    }
  }
  await plantRepository.updateDerived(plantId, derivedPatch);
}
