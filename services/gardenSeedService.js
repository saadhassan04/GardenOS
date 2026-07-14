/**
 * Starter garden seeding (Business layer, L3).
 * Plants the owner's documented collection exactly once, on a fresh
 * install only. Guards, in order:
 *   1. an appMeta flag (ownerGardenSeededAt) — set forever after any run,
 *      so a deliberately emptied garden is never re-seeded;
 *   2. a non-empty plants store — an existing garden (e.g. restored from
 *      backup before this code ever ran) marks the flag and seeds nothing.
 */

import {
  KARACHI_STARTER_GARDEN,
  CATEGORY_FIXUPS,
  PHOTO_AUDIT_CATEGORY_FIXUPS,
  PHOTO_AUDIT_BOTANICAL_FIXUPS,
} from '../database/seed/ownerGarden.karachi.js';
import { validatePlant } from '../models/Plant.js';
import { plantRepository } from '../database/PlantRepository.js';
import { openDatabase, getAppMeta } from '../database/db.js';
import { transactionDone } from '../database/idb.js';
import { STORES } from '../database/stores.js';
import { listCareProfiles } from './careProfileService.js';
import { updatePlant } from './plantService.js';
import { bus } from '../hooks/bus.js';
import { logger } from '../utils/logger.js';

const FLAG_KEY = 'ownerGardenSeededAt';
const RECAT_FLAG_KEY = 'ownerGardenRecategorizedAt';
const PHOTO_AUDIT_FLAG_KEY = 'ownerPhotoAuditCorrectedAt';

/** @returns {Promise<{seeded: number}>} */
export async function ensureSeededGarden() {
  const meta = await getAppMeta();
  if (meta[FLAG_KEY]) {
    return { seeded: 0 };
  }
  if ((await plantRepository.count()) > 0) {
    await setFlag(FLAG_KEY);
    return { seeded: 0 };
  }

  const profiles = await listCareProfiles();
  const profileByName = new Map(profiles.map((profile) => [profile.name, profile]));

  const bodies = KARACHI_STARTER_GARDEN.map((entry) =>
    validatePlant({
      name: entry.name,
      botanicalName: entry.botanicalName,
      category: entry.category,
      careProfileId: entry.careProfileName
        ? profileByName.get(entry.careProfileName)?.id ?? null
        : null,
    }),
  );

  await plantRepository.addMany(bodies);
  await setFlag(FLAG_KEY);
  await setFlag(RECAT_FLAG_KEY); // fresh seed already uses final categories
  await setFlag(PHOTO_AUDIT_FLAG_KEY); // …and final names/botanicals
  logger.info(`Seeded the starter garden (${bodies.length} plants)`);
  bus.emit('plant:created', { seeded: bodies.length });
  return { seeded: bodies.length };
}

/**
 * One-time category correction for gardens seeded before the richer
 * taxonomy existed (CATEGORY_FIXUPS). Runs once (appMeta flag) and only
 * touches plants whose category still equals the original seeded value, so
 * a plant the user has already recategorized is never overwritten.
 * @returns {Promise<{updated: number}>}
 */
export async function ensureGardenRecategorized() {
  const meta = await getAppMeta();
  if (meta[RECAT_FLAG_KEY]) {
    return { updated: 0 };
  }

  let updated = 0;
  for (const fix of CATEGORY_FIXUPS) {
    for (const plant of await findPlantsByName(fix.name)) {
      if (plant.category === fix.from) {
        await updatePlant(plant.id, { category: fix.to });
        updated += 1;
      }
    }
  }

  await setFlag(RECAT_FLAG_KEY);
  if (updated > 0) {
    logger.info(`Recategorized ${updated} seeded plants to the new taxonomy`);
    bus.emit('plant:updated', { recategorized: updated });
  }
  return { updated };
}

/**
 * One-time photo-audit corrections (Sprint S-14, AD-009). Fixes the
 * categories that CATEGORY_FIXUPS missed because the owner had renamed the
 * plants, and fills in botanical names the audit identified. Runs once (an
 * appMeta flag) and is field-surgical: a category changes only while it still
 * equals the audited wrong value, a botanical name only while it is still
 * empty — so owner edits made since the audit are never clobbered, and a
 * fresh install (already seeded at the final values) is a no-op.
 * @returns {Promise<{updated: number}>}
 */
export async function ensurePhotoAuditCorrected() {
  const meta = await getAppMeta();
  if (meta[PHOTO_AUDIT_FLAG_KEY]) {
    return { updated: 0 };
  }

  let updated = 0;
  for (const fix of PHOTO_AUDIT_CATEGORY_FIXUPS) {
    for (const plant of await findPlantsByName(fix.name)) {
      if (plant.category === fix.from) {
        await updatePlant(plant.id, { category: fix.to });
        updated += 1;
      }
    }
  }
  for (const fix of PHOTO_AUDIT_BOTANICAL_FIXUPS) {
    for (const plant of await findPlantsByName(fix.name)) {
      if (!plant.botanicalName) {
        await updatePlant(plant.id, { botanicalName: fix.botanicalName });
        updated += 1;
      }
    }
  }

  await setFlag(PHOTO_AUDIT_FLAG_KEY);
  if (updated > 0) {
    logger.info(`Applied ${updated} photo-audit corrections`);
    bus.emit('plant:updated', { photoAuditCorrected: updated });
  }
  return { updated };
}

/**
 * Plants carrying an exact name (soft-deleted ones excluded by the
 * repository). Duplicated names are legal, so every match is returned.
 * @param {string} name
 * @returns {Promise<object[]>}
 */
async function findPlantsByName(name) {
  const { items } = await plantRepository.query({
    index: 'name',
    range: IDBKeyRange.only(name),
    limit: 50,
  });
  return items;
}

async function setFlag(key) {
  const db = await openDatabase();
  const tx = db.transaction(STORES.appMeta, 'readwrite');
  tx.objectStore(STORES.appMeta).put({ key, value: new Date().toISOString() });
  await transactionDone(tx);
}

/** Test hook: clear the seed + correction flags (never used by the app). */
export async function _clearSeedFlagForTests() {
  const db = await openDatabase();
  const tx = db.transaction(STORES.appMeta, 'readwrite');
  tx.objectStore(STORES.appMeta).delete(FLAG_KEY);
  tx.objectStore(STORES.appMeta).delete(RECAT_FLAG_KEY);
  tx.objectStore(STORES.appMeta).delete(PHOTO_AUDIT_FLAG_KEY);
  await transactionDone(tx);
}
