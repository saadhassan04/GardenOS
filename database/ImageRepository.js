/**
 * Image repository (Data layer, L2) — DATABASE.md §3.5–3.6, FR-6.
 * Owns the cross-store transactions image work requires: an ingest writes
 * the image, its thumbnail, and the owning plant's derived counts/cover in
 * ONE transaction (NFR-4.1); removal reverses all of it.
 */

import { Repository } from './Repository.js';
import { STORES } from './stores.js';
import { openDatabase } from './db.js';
import { promisify, transactionDone } from './idb.js';
import { stampNew } from '../models/envelope.js';
import { NotFoundError, StorageError, ValidationError } from '../utils/errors.js';

/** Upper bound sentinel for "all capturedAt values of one plant". */
const MAX_CHAR = '￿';

export class ImageRepository extends Repository {
  constructor() {
    super(STORES.images);
  }

  /**
   * Store an image + its thumbnail + plant bookkeeping atomically.
   * First photo of a plant becomes its cover automatically (FR-6.2).
   * @param {object} recordBody validated image body (models/ImageRecord.js)
   * @param {Blob} thumbBlob
   * @param {{width: number, height: number}} thumbSize
   * @returns {Promise<object>} the stamped image record
   */
  async ingest(recordBody, thumbBlob, thumbSize) {
    const record = stampNew(recordBody);
    const db = await openDatabase();
    const tx = db.transaction([STORES.images, STORES.thumbnails, STORES.plants], 'readwrite');

    tx.objectStore(STORES.images).add(record);
    tx.objectStore(STORES.thumbnails).put({
      imageId: record.id,
      blob: thumbBlob,
      width: thumbSize.width,
      height: thumbSize.height,
    });

    if (record.plantId) {
      const plantStore = tx.objectStore(STORES.plants);
      const plant = await promisify(plantStore.get(record.plantId));
      if (!plant || plant.deletedAt) {
        tx.abort();
        throw new NotFoundError('That plant no longer exists');
      }
      plantStore.put({
        ...plant,
        coverImageId: plant.coverImageId ?? record.id,
        derived: { ...plant.derived, imageCount: plant.derived.imageCount + 1 },
        updatedAt: new Date().toISOString(),
      });
    }

    await transactionDone(tx);
    return record;
  }

  /**
   * Remove an image, its thumbnail, and its plant bookkeeping atomically.
   * The cover slot empties rather than guessing a replacement.
   * @param {string} imageId
   */
  async removeCascade(imageId) {
    const db = await openDatabase();
    const tx = db.transaction([STORES.images, STORES.thumbnails, STORES.plants], 'readwrite');
    const imageStore = tx.objectStore(STORES.images);
    const record = await promisify(imageStore.get(imageId));
    if (!record) {
      tx.abort();
      throw new NotFoundError('That photo no longer exists');
    }

    imageStore.delete(imageId);
    tx.objectStore(STORES.thumbnails).delete(imageId);

    if (record.plantId) {
      const plantStore = tx.objectStore(STORES.plants);
      const plant = await promisify(plantStore.get(record.plantId));
      if (plant) {
        plantStore.put({
          ...plant,
          coverImageId: plant.coverImageId === imageId ? null : plant.coverImageId,
          derived: { ...plant.derived, imageCount: Math.max(0, plant.derived.imageCount - 1) },
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await transactionDone(tx);
    return record;
  }

  /**
   * Live photo count for a plant — the source of truth behind
   * derived.imageCount. Images are hard-deleted by removeCascade (no
   * tombstones), so the native index count is exact. Mirrors
   * EventRepository.countForPlant.
   * @param {string} plantId
   * @returns {Promise<number>}
   */
  async countForPlant(plantId) {
    return this.count({ index: 'plantId', range: IDBKeyRange.only(plantId) });
  }

  /**
   * A plant's photos, newest capture first — the growth gallery query
   * (`[plantId+capturedAt]`, DATABASE.md §6). Same visited-offset cursor
   * semantics as Repository.query.
   * @param {string} plantId
   * @param {{limit?: number, cursor?: string|null}} [options]
   * @returns {Promise<{items: object[], nextCursor: string|null}>}
   */
  async getGrowthSeries(plantId, { limit = 24, cursor = null } = {}) {
    return this.#pagedCursor({
      indexName: 'plantId_capturedAt',
      range: IDBKeyRange.bound([plantId, ''], [plantId, MAX_CHAR]),
      limit,
      cursor,
    });
  }

  /**
   * Every photo in the garden, newest capture first (all-photos gallery).
   * @param {{limit?: number, cursor?: string|null}} [options]
   */
  async getAllPhotos({ limit = 24, cursor = null } = {}) {
    return this.#pagedCursor({ indexName: 'capturedAt', range: null, limit, cursor });
  }

  async #pagedCursor({ indexName, range, limit, cursor }) {
    const offset = cursor === null ? 0 : Number(cursor);
    if (!Number.isInteger(offset) || offset < 0) {
      throw new ValidationError(`Invalid gallery cursor "${cursor}"`);
    }
    const db = await openDatabase();
    const index = db
      .transaction(this.storeName, 'readonly')
      .objectStore(this.storeName)
      .index(indexName);

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
        if (!cur.value.deletedAt) {
          items.push(cur.value);
        }
        if (items.length >= limit) {
          resolve();
          return;
        }
        cur.continue();
      };
      request.onerror = () =>
        reject(new StorageError(request.error?.message ?? 'Gallery query failed', {
          cause: request.error ?? undefined,
        }));
    });

    return { items, nextCursor: items.length >= limit ? String(offset + visited) : null };
  }

  /**
   * @param {string} imageId
   * @returns {Promise<{imageId: string, blob: Blob}|null>}
   */
  async getThumbnail(imageId) {
    const db = await openDatabase();
    const store = db.transaction(STORES.thumbnails, 'readonly').objectStore(STORES.thumbnails);
    return (await promisify(store.get(imageId))) ?? null;
  }
}

export const imageRepository = new ImageRepository();
