/**
 * Kitchen garden service (Business layer, L3) — API_DESIGN.md §2, FR-5,
 * T-060/T-062. Sowing lifecycle (forward-only stages with history),
 * harvest logging that feeds both yield analytics and — for plant-linked
 * batches — the event-sourced timeline, and per-season totals.
 */

import { validateSowingBatch, SOWING_STAGES } from '../models/SowingBatch.js';
import { validateHarvest } from '../models/Harvest.js';
import { Repository } from '../database/Repository.js';
import { STORES } from '../database/stores.js';
import { logEvent } from './careEventService.js';
import { bus } from '../hooks/bus.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const batchRepository = new Repository(STORES.sowingBatches);
const harvestRepository = new Repository(STORES.harvests);

/** @param {object} input @returns {Promise<object>} the created batch */
export async function createBatch(input) {
  const batch = await batchRepository.add(validateSowingBatch(input));
  bus.emit('batch:created', { batchId: batch.id, crop: batch.crop });
  return batch;
}

/** @param {string} batchId @returns {Promise<object|null>} */
export function getBatch(batchId) {
  return batchRepository.get(batchId);
}

/**
 * Move a batch to a LATER lifecycle stage (skipping stages is fine —
 * direct-sown crops never transplant). Backward moves are refused; the
 * history is the record (FR-5.1).
 * @param {string} batchId
 * @param {string} stage a SOWING_STAGES value later than the current one
 * @param {{at?: string}} [options] backdatable
 * @returns {Promise<object>} the updated batch
 */
export async function advanceStage(batchId, stage, { at } = {}) {
  const batch = await batchRepository.get(batchId);
  if (!batch) {
    throw new NotFoundError('That sowing batch no longer exists');
  }
  const fromIndex = SOWING_STAGES.indexOf(batch.stage);
  const toIndex = SOWING_STAGES.indexOf(stage);
  if (toIndex === -1) {
    throw new ValidationError(`Unknown sowing stage "${stage}"`);
  }
  if (toIndex <= fromIndex) {
    throw new ValidationError(
      `A batch moves forward only (${batch.stage} → ${stage} is backwards)`,
    );
  }

  const atISO = at ? new Date(at).toISOString() : new Date().toISOString();
  const updated = await batchRepository.update(batchId, {
    stage,
    stageHistory: [...batch.stageHistory, { stage, at: atISO }],
  });

  if (batch.plantId) {
    await logEvent(batch.plantId, 'stage-change', {
      occurredAt: atISO,
      data: { sowingBatchId: batchId, from: batch.stage, to: stage },
    });
  }

  bus.emit('batch:stage-changed', { batchId, from: batch.stage, to: stage });
  return updated;
}

/**
 * @param {{includeFinished?: boolean}} [options]
 * @returns {Promise<object[]>} batches, newest sowing first
 */
export async function listBatches({ includeFinished = false } = {}) {
  const { items } = await batchRepository.query({ limit: 500 });
  return items
    .filter((batch) => includeFinished || batch.stage !== 'finished')
    .sort((a, b) => b.sownAt.localeCompare(a.sownAt) || a.crop.localeCompare(b.crop));
}

/**
 * Log a harvest (FR-5.3). Batch-linked harvests inherit the batch's crop
 * when none is given and pull a pre-"harvesting" batch forward to
 * harvesting automatically — picking produce IS the stage change.
 * @param {object} input {sowingBatchId?, plantId?, crop?, quantity, unit, quality?, harvestedAt?, notes?}
 * @returns {Promise<object>} the harvest record
 */
export async function logHarvest(input) {
  let batch = null;
  if (input.sowingBatchId) {
    batch = await batchRepository.get(input.sowingBatchId);
    if (!batch) {
      throw new NotFoundError('That sowing batch no longer exists');
    }
  }

  const harvest = await harvestRepository.add(
    validateHarvest({ ...input, crop: input.crop ?? batch?.crop }),
  );

  if (batch && SOWING_STAGES.indexOf(batch.stage) < SOWING_STAGES.indexOf('harvesting')) {
    await advanceStage(batch.id, 'harvesting', { at: harvest.harvestedAt });
  }

  const plantId = harvest.plantId ?? batch?.plantId ?? null;
  if (plantId) {
    await logEvent(plantId, 'harvest', {
      occurredAt: harvest.harvestedAt,
      data: { harvestId: harvest.id, crop: harvest.crop, quantity: harvest.quantity, unit: harvest.unit },
    });
  }

  bus.emit('harvest:logged', { harvestId: harvest.id, crop: harvest.crop });
  return harvest;
}

/**
 * Yield totals grouped by crop and unit (FR-5.3).
 * @param {{crop?: string|null, from?: string|null, to?: string|null}} [options]
 * @returns {Promise<{byCrop: Record<string, Record<string, number>>, entries: number}>}
 */
export async function getYield({ crop = null, from = null, to = null } = {}) {
  let index = 'harvestedAt';
  let range = null;
  if (crop) {
    index = 'crop_harvestedAt';
    range = IDBKeyRange.bound([crop, from ?? ''], [crop, to ?? '￿']);
  } else if (from || to) {
    range = IDBKeyRange.bound(from ?? '', to ?? '￿');
  }

  const { items } = await harvestRepository.query({ index, range, limit: 5000 });
  const byCrop = {};
  for (const harvest of items) {
    const units = (byCrop[harvest.crop] ??= {});
    units[harvest.unit] = (units[harvest.unit] ?? 0) + harvest.quantity;
  }
  return { byCrop, entries: items.length };
}

/**
 * The current Karachi growing season's date range for yield summaries:
 * winter (Oct–Feb, the main season) or summer (Mar–Sep).
 * @param {Date} [date]
 * @returns {{label: string, from: string, to: string}}
 */
export function currentGrowingSeason(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 10) {
    return {
      label: `Winter ${year}–${String(year + 1).slice(2)}`,
      from: new Date(Date.UTC(year, 9, 1)).toISOString(),
      to: new Date(Date.UTC(year + 1, 2, 1)).toISOString(),
    };
  }
  if (month <= 2) {
    return {
      label: `Winter ${year - 1}–${String(year).slice(2)}`,
      from: new Date(Date.UTC(year - 1, 9, 1)).toISOString(),
      to: new Date(Date.UTC(year, 2, 1)).toISOString(),
    };
  }
  return {
    label: `Summer ${year}`,
    from: new Date(Date.UTC(year, 2, 1)).toISOString(),
    to: new Date(Date.UTC(year, 9, 1)).toISOString(),
  };
}
