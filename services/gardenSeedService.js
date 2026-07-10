/**
 * Starter garden seeding (Business layer, L3).
 * Plants the owner's documented collection exactly once, on a fresh
 * install only. Guards, in order:
 *   1. an appMeta flag (ownerGardenSeededAt) — set forever after any run,
 *      so a deliberately emptied garden is never re-seeded;
 *   2. a non-empty plants store — an existing garden (e.g. restored from
 *      backup before this code ever ran) marks the flag and seeds nothing.
 */

import { KARACHI_STARTER_GARDEN } from '../database/seed/ownerGarden.karachi.js';
import { validatePlant } from '../models/Plant.js';
import { plantRepository } from '../database/PlantRepository.js';
import { openDatabase, getAppMeta } from '../database/db.js';
import { transactionDone } from '../database/idb.js';
import { STORES } from '../database/stores.js';
import { listCareProfiles } from './careProfileService.js';
import { bus } from '../hooks/bus.js';
import { logger } from '../utils/logger.js';

const FLAG_KEY = 'ownerGardenSeededAt';

/** @returns {Promise<{seeded: number}>} */
export async function ensureSeededGarden() {
  const meta = await getAppMeta();
  if (meta[FLAG_KEY]) {
    return { seeded: 0 };
  }
  if ((await plantRepository.count()) > 0) {
    await setFlag();
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
  await setFlag();
  logger.info(`Seeded the starter garden (${bodies.length} plants)`);
  bus.emit('plant:created', { seeded: bodies.length });
  return { seeded: bodies.length };
}

async function setFlag() {
  const db = await openDatabase();
  const tx = db.transaction(STORES.appMeta, 'readwrite');
  tx.objectStore(STORES.appMeta).put({ key: FLAG_KEY, value: new Date().toISOString() });
  await transactionDone(tx);
}

/** Test hook: clear the seed flag (never used by the app). */
export async function _clearSeedFlagForTests() {
  const db = await openDatabase();
  const tx = db.transaction(STORES.appMeta, 'readwrite');
  tx.objectStore(STORES.appMeta).delete(FLAG_KEY);
  await transactionDone(tx);
}
