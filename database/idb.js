/**
 * IndexedDB promisification helpers (Data layer, L2).
 * The raw IndexedDB API is event-based; everything above db.js works with
 * promises. These helpers are the only place that translation happens.
 */

import { StorageError } from '../utils/errors.js';

/**
 * Resolve with an IDBRequest's result, reject with a StorageError.
 * @param {IDBRequest} request
 * @returns {Promise<*>}
 */
export function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new StorageError(request.error?.message ?? 'IndexedDB request failed', {
        cause: request.error ?? undefined,
      }));
  });
}

/**
 * Resolve when a transaction commits; reject if it aborts or errors.
 * Await this after queuing writes — it is the atomicity guarantee (NFR-4.1).
 * @param {IDBTransaction} transaction
 * @returns {Promise<void>}
 */
export function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(new StorageError(transaction.error?.message ?? 'Transaction aborted', {
        cause: transaction.error ?? undefined,
      }));
    transaction.onerror = () =>
      reject(new StorageError(transaction.error?.message ?? 'Transaction failed', {
        cause: transaction.error ?? undefined,
      }));
  });
}
