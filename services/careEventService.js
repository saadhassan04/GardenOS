/**
 * Care event service (Business layer, L3) — API_DESIGN.md §2, FR-2/FR-3.
 * Event-sourced care history (ARCHITECTURE.md D4): every log appends
 * immutable events, then refreshes the plants' derived caches. Every log —
 * single or bulk — carries a batchId so Undo is uniform.
 */

import { validateCareEvent } from '../models/CareEvent.js';
import { eventRepository } from '../database/EventRepository.js';
import { plantRepository } from '../database/PlantRepository.js';
import { imageRepository } from '../database/ImageRepository.js';
import { EVENT_TYPES } from '../config/registries.js';
import { uuid } from '../utils/uuid.js';
import { bus } from '../hooks/bus.js';
import { logger } from '../utils/logger.js';
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
 * Full derived-cache rebuild for one plant, from the immutable records that
 * own the truth: the events log and the images store. Used by the undo path
 * and by the Diagnostics rebuild tool. Derived values are caches — this is
 * the proof, and the only definition of how they are computed.
 * @param {string} plantId
 */
export async function recomputeDerived(plantId) {
  const plant = await plantRepository.get(plantId);
  if (!plant) {
    return; // plant deleted meanwhile — nothing to recompute
  }
  const derivedPatch = {
    eventCount: await eventRepository.countForPlant(plantId),
    imageCount: await imageRepository.countForPlant(plantId),
  };
  for (const [type, spec] of Object.entries(EVENT_TYPES)) {
    if (spec.derivedField) {
      const last = await eventRepository.lastOfType(plantId, type);
      derivedPatch[spec.derivedField] = last?.occurredAt ?? null;
    }
  }
  await plantRepository.updateDerived(plantId, derivedPatch);
}

/**
 * Recompute every plant's derived cache (Diagnostics tool — ADR-0002 listed
 * this as the recovery path for caches that drift; TD-L6). Reports how many
 * plants actually changed, so a healthy garden is visibly a no-op rather
 * than a silent one. Soft-deleted plants are skipped — the repository
 * excludes them and their caches are moot.
 * @returns {Promise<{scanned: number, repaired: number}>}
 */
export async function rebuildAllDerivedCaches() {
  let scanned = 0;
  let repaired = 0;
  let cursor = null;

  do {
    const page = await plantRepository.query({ limit: 100, cursor });
    for (const plant of page.items) {
      await recomputeDerived(plant.id);
      const after = await plantRepository.get(plant.id);
      if (after && derivedDiffers(plant.derived, after.derived)) {
        repaired += 1;
      }
      scanned += 1;
    }
    cursor = page.nextCursor;
  } while (cursor);

  logger.info(`Derived-cache rebuild: ${scanned} plants scanned, ${repaired} repaired`);
  if (repaired > 0) {
    bus.emit('plant:updated', { rebuilt: repaired });
  }
  return { scanned, repaired };
}

/**
 * Key-order-independent comparison — derived values are primitives.
 * @param {object} before
 * @param {object} after
 * @returns {boolean}
 */
function derivedDiffers(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].some((key) => before[key] !== after[key]);
}
