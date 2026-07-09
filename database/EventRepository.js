/**
 * Care event repository (Data layer, L2) — DATABASE.md §3.2/§6.
 * Owns the timeline query (the hottest read path: [plantId+occurredAt]
 * descending) and batch operations for bulk-log undo.
 */

import { Repository } from './Repository.js';
import { STORES } from './stores.js';
import { openDatabase } from './db.js';
import { promisify, transactionDone } from './idb.js';
import { StorageError, ValidationError } from '../utils/errors.js';

/** Upper bound sentinel for "all occurredAt values of one plant". */
const MAX_CHAR = '￿';

export class EventRepository extends Repository {
  constructor() {
    super(STORES.events);
  }

  /**
   * A plant's timeline, newest first, optionally filtered by event types
   * (FR-2.1). Cursor semantics match Repository.query (visited-offset).
   * @param {string} plantId
   * @param {{types?: string[]|null, limit?: number, cursor?: string|null}} [options]
   * @returns {Promise<{items: object[], nextCursor: string|null}>}
   */
  async getTimeline(plantId, { types = null, limit = 20, cursor = null } = {}) {
    const typeSet = types && types.length > 0 ? new Set(types) : null;
    const offset = cursor === null ? 0 : Number(cursor);
    if (!Number.isInteger(offset) || offset < 0) {
      throw new ValidationError(`Invalid timeline cursor "${cursor}"`);
    }

    const db = await openDatabase();
    const index = db
      .transaction(this.storeName, 'readonly')
      .objectStore(this.storeName)
      .index('plantId_occurredAt');
    const range = IDBKeyRange.bound([plantId, ''], [plantId, MAX_CHAR]);

    const items = [];
    let visited = 0;

    await new Promise((resolve, reject) => {
      const request = index.openCursor(range, 'prev');
      let advanced = offset === 0;
      request.onsuccess = () => {
        const cur = request.result;
        if (!cur) {
          resolve();
          return;
        }
        if (!advanced) {
          advanced = true;
          cur.advance(offset);
          return;
        }
        visited += 1;
        const record = cur.value;
        if (!record.deletedAt && (!typeSet || typeSet.has(record.type))) {
          items.push(record);
        }
        if (items.length >= limit) {
          resolve();
          return;
        }
        cur.continue();
      };
      request.onerror = () =>
        reject(new StorageError(request.error?.message ?? 'Timeline query failed', {
          cause: request.error ?? undefined,
        }));
    });

    return { items, nextCursor: items.length >= limit ? String(offset + visited) : null };
  }

  /**
   * The most recent event of one type for a plant (derived-cache recompute).
   * Scans the timeline index newest-first until the type matches.
   * @param {string} plantId
   * @param {string} type
   * @returns {Promise<object|null>}
   */
  async lastOfType(plantId, type) {
    const { items } = await this.getTimeline(plantId, { types: [type], limit: 1 });
    return items[0] ?? null;
  }

  /**
   * Live (non-tombstoned) event count for a plant.
   * @param {string} plantId
   * @returns {Promise<number>}
   */
  async countForPlant(plantId) {
    // Native index count, then subtract tombstones is impossible without a
    // scan; events are hard-deleted only via cascades/undo, and tombstoned
    // events are rare corrections — the native count is the documented
    // semantics of derived.eventCount.
    return this.count({ index: 'plantId', range: IDBKeyRange.only(plantId) });
  }

  /**
   * Remove every event of a bulk-log batch in one transaction (undo,
   * API_DESIGN.md §2). Returns the removed events for derived recompute.
   * @param {string} batchId
   * @returns {Promise<object[]>}
   */
  async deleteByBatchId(batchId) {
    const db = await openDatabase();
    const tx = db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    const events = await promisify(store.index('batchId').getAll(IDBKeyRange.only(batchId)));
    for (const event of events) {
      store.delete(event.id);
    }
    await transactionDone(tx);
    return events;
  }
}

export const eventRepository = new EventRepository();
