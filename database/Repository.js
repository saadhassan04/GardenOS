/**
 * Repository base class (Data layer, L2) — API_DESIGN.md §1, TODO T-018.
 * The only gateway to an object store. Guarantees:
 *   - envelope stamping on create (models/envelope.js),
 *   - soft deletes by default; tombstones hidden from reads unless asked,
 *   - transactional multi-record writes (NFR-4.1),
 *   - cursor-paginated queries that never materialize a whole store,
 *   - streamed export / transactional import for backup (v1.0).
 * Specialized repositories (PlantRepository…) extend this with indexed
 * queries and cross-store cascades from v1.1 on.
 */

import { openDatabase } from './db.js';
import { promisify, transactionDone } from './idb.js';
import { stampNew, touch } from '../models/envelope.js';
import { NotFoundError, ValidationError, StorageError } from '../utils/errors.js';

export class Repository {
  /** @param {string} storeName a name from database/stores.js */
  constructor(storeName) {
    this.storeName = storeName;
  }

  /**
   * @param {'readonly'|'readwrite'} mode
   * @returns {Promise<{tx: IDBTransaction, store: IDBObjectStore}>}
   */
  async #open(mode) {
    const db = await openDatabase();
    const tx = db.transaction(this.storeName, mode);
    return { tx, store: tx.objectStore(this.storeName) };
  }

  /**
   * @param {string} id
   * @param {{includeDeleted?: boolean}} [options]
   * @returns {Promise<object|null>} null when missing or soft-deleted
   */
  async get(id, { includeDeleted = false } = {}) {
    const { store } = await this.#open('readonly');
    const record = await promisify(store.get(id));
    if (!record || (record.deletedAt && !includeDeleted)) {
      return null;
    }
    return record;
  }

  /**
   * @param {string[]} ids
   * @returns {Promise<object[]>} found, non-deleted records (order preserved)
   */
  async getMany(ids) {
    const { store } = await this.#open('readonly');
    const records = await Promise.all(ids.map((id) => promisify(store.get(id))));
    return records.filter((record) => record && !record.deletedAt);
  }

  /**
   * Create one record. Fails (atomically) if the id already exists.
   * @param {object} record
   * @returns {Promise<object>} the stamped record
   */
  async add(record) {
    const [stamped] = await this.addMany([record]);
    return stamped;
  }

  /**
   * Create many records in ONE transaction — all or nothing (NFR-4.1).
   * @param {object[]} records
   * @returns {Promise<object[]>} the stamped records
   */
  async addMany(records) {
    if (!Array.isArray(records) || records.length === 0) {
      throw new ValidationError('addMany() requires a non-empty array');
    }
    const stamped = records.map(stampNew);
    const { tx, store } = await this.#open('readwrite');
    for (const record of stamped) {
      store.add(record); // .add (not .put): duplicate ids abort the transaction
    }
    await transactionDone(tx);
    return stamped;
  }

  /**
   * Merge a patch into an existing, non-deleted record.
   * @param {string} id
   * @param {object} patch id/createdAt cannot be changed
   * @returns {Promise<object>} the updated record
   */
  async update(id, patch) {
    const { tx, store } = await this.#open('readwrite');
    const existing = await promisify(store.get(id));
    if (!existing || existing.deletedAt) {
      throw new NotFoundError(`No ${this.storeName} record with id ${id}`);
    }
    const merged = touch({ ...existing, ...patch, id: existing.id, createdAt: existing.createdAt });
    store.put(merged);
    await transactionDone(tx);
    return merged;
  }

  /**
   * Tombstone a record (default deletion mode, NFR-4.3). Idempotent.
   * @param {string} id
   */
  async softDelete(id) {
    const { tx, store } = await this.#open('readwrite');
    const existing = await promisify(store.get(id));
    if (!existing) {
      throw new NotFoundError(`No ${this.storeName} record with id ${id}`);
    }
    if (existing.deletedAt) {
      return; // already tombstoned
    }
    store.put(touch({ ...existing, deletedAt: new Date().toISOString() }));
    await transactionDone(tx);
  }

  /**
   * Physically remove a record. Base class removes from THIS store only;
   * specialized repositories own cross-store cascades (DATABASE.md §4).
   * @param {string} id
   */
  async hardDelete(id) {
    const { tx, store } = await this.#open('readwrite');
    store.delete(id);
    await transactionDone(tx);
  }

  /**
   * Cursor-paginated query.
   *
   * The continuation cursor is an opaque visited-count offset, resumed with
   * IDBCursor.advance(). Deliberate tradeoff: it is correct for every index,
   * key type, and direction (including 'prev' timelines and duplicate index
   * keys, where key-range resumption silently skips records). Deep-page cost
   * is native-side skipping — acceptable at our scale (NFR-2.2); revisit via
   * ADR if profiling ever says otherwise.
   *
   * @param {{index?: string, range?: IDBKeyRange, direction?: IDBCursorDirection,
   *          limit?: number, cursor?: string|null, includeDeleted?: boolean}} [options]
   * @returns {Promise<{items: object[], nextCursor: string|null}>}
   */
  async query({
    index = null,
    range = null,
    direction = 'next',
    limit = 50,
    cursor = null,
    includeDeleted = false,
  } = {}) {
    const { store } = await this.#open('readonly');
    const source = index ? store.index(index) : store;
    const offset = cursor === null ? 0 : Number(cursor);
    if (!Number.isInteger(offset) || offset < 0) {
      throw new ValidationError(`Invalid query cursor "${cursor}"`);
    }

    const items = [];
    let visited = 0;

    await new Promise((resolve, reject) => {
      const request = source.openCursor(range, direction);
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
        if (includeDeleted || !cur.value.deletedAt) {
          items.push(cur.value);
        }
        if (items.length >= limit) {
          resolve();
          return;
        }
        cur.continue();
      };
      request.onerror = () =>
        reject(new StorageError(request.error?.message ?? 'Query cursor failed', {
          cause: request.error ?? undefined,
        }));
    });

    return {
      items,
      nextCursor: items.length >= limit ? String(offset + visited) : null,
    };
  }

  /**
   * Native record count. Includes soft-deleted records (index counts are
   * cheap; exact active counts come from query()).
   * @param {{index?: string, range?: IDBKeyRange}} [options]
   * @returns {Promise<number>}
   */
  async count({ index = null, range = null } = {}) {
    const { store } = await this.#open('readonly');
    const source = index ? store.index(index) : store;
    return promisify(source.count(range ?? undefined));
  }

  /**
   * Stream every record — INCLUDING tombstones — in primary-key order,
   * for backup (API_DESIGN.md §1 exportAll). Each batch is read in its own
   * transaction so the callback may be async without stalling IndexedDB.
   * @param {(records: object[], keys: IDBValidKey[]) => void|Promise<void>} onBatch
   *   receives primary keys too, so out-of-line-key stores survive backup
   * @param {{batchSize?: number}} [options]
   */
  async exportAll(onBatch, { batchSize = 250 } = {}) {
    let lastKey = null;
    for (;;) {
      const { store } = await this.#open('readonly');
      const range = lastKey === null ? undefined : IDBKeyRange.lowerBound(lastKey, true);
      const [records, keys] = await Promise.all([
        promisify(store.getAll(range, batchSize)),
        promisify(store.getAllKeys(range, batchSize)),
      ]);
      if (records.length === 0) {
        return;
      }
      await onBatch(records, keys);
      if (records.length < batchSize) {
        return;
      }
      lastKey = keys[keys.length - 1];
    }
  }

  /**
   * Import records in ONE transaction (restore/import flows).
   * @param {object[]} records already-enveloped records (put semantics)
   * @param {{mode?: 'merge'|'replace'}} [options] replace clears the store first
   * @returns {Promise<{imported: number, mode: string}>}
   */
  async importBatch(records, { mode = 'merge' } = {}) {
    if (!Array.isArray(records)) {
      throw new ValidationError('importBatch() requires an array');
    }
    if (mode !== 'merge' && mode !== 'replace') {
      throw new ValidationError(`Unknown import mode "${mode}"`);
    }
    const { tx, store } = await this.#open('readwrite');
    if (mode === 'replace') {
      store.clear();
    }
    for (const record of records) {
      store.put(record);
    }
    await transactionDone(tx);
    return { imported: records.length, mode };
  }

  /** Remove every record (test teardown and replace-mode restore). */
  async clearAll() {
    const { tx, store } = await this.#open('readwrite');
    store.clear();
    await transactionDone(tx);
  }
}
