/**
 * Plant repository (Data layer, L2) — DATABASE.md §3.1/§4.
 * Adds plant-specific queries and the cross-store cascade that the base
 * class deliberately doesn't own.
 */

import { Repository } from './Repository.js';
import { STORES } from './stores.js';
import { openDatabase } from './db.js';
import { promisify, transactionDone } from './idb.js';
import { NotFoundError } from '../utils/errors.js';

export class PlantRepository extends Repository {
  constructor() {
    super(STORES.plants);
  }

  /**
   * All non-deleted plants with a given status (the main list query,
   * via the status index; category/search/sort refine client-side at
   * collection scale — DATABASE.md §6).
   * @param {string} status
   * @returns {Promise<object[]>}
   */
  async listByStatus(status) {
    const { items } = await this.query({
      index: 'status',
      range: IDBKeyRange.only(status),
      limit: 1000,
    });
    return items;
  }

  /**
   * Merge a patch into the derived cache sub-object (DATABASE.md §3.1).
   * Derived values are recomputable from events; this is a cache refresh,
   * not a user edit, but it still stamps updatedAt via update().
   * @param {string} plantId
   * @param {object} derivedPatch e.g. {lastWateredAt, eventCount}
   */
  async updateDerived(plantId, derivedPatch) {
    const plant = await this.get(plantId);
    if (!plant) {
      throw new NotFoundError(`No plant with id ${plantId}`);
    }
    await this.update(plantId, { derived: { ...plant.derived, ...derivedPatch } });
  }

  /**
   * Permanently delete a plant AND its events in one transaction
   * (DATABASE.md §4 cascade). Image cascade joins in v1.2.
   * @param {string} plantId
   * @returns {Promise<{deletedEvents: number}>}
   */
  async hardDeleteCascade(plantId) {
    const db = await openDatabase();
    const tx = db.transaction([STORES.plants, STORES.events], 'readwrite');
    const eventStore = tx.objectStore(STORES.events);
    const eventKeys = await promisify(
      eventStore.index('plantId').getAllKeys(IDBKeyRange.only(plantId)),
    );
    for (const key of eventKeys) {
      eventStore.delete(key);
    }
    tx.objectStore(STORES.plants).delete(plantId);
    await transactionDone(tx);
    return { deletedEvents: eventKeys.length };
  }

  /**
   * Archive/unarchive convenience: status changes preserve all history
   * (FR-1.5).
   * @param {string} plantId
   * @param {string} status a PLANT_STATUSES key (validated upstream)
   */
  async setStatus(plantId, status) {
    const plant = await this.get(plantId);
    if (!plant) {
      throw new NotFoundError(`No plant with id ${plantId}`);
    }
    return this.update(plantId, { status });
  }
}

export const plantRepository = new PlantRepository();
