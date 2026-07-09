/**
 * Export service (Business layer, L3) — API_DESIGN.md §7, FR-9.1, TODO T-022.
 * Builds complete backup archives. DOM-free: returns data; the UI layer
 * decides how to hand files to the user (components/fileTransfer.js).
 * Selective/CSV export (FR-9.3) arrives with the data-bearing modules.
 */

import { APP_NAME, APP_VERSION, DB_SCHEMA_VERSION } from '../config/constants.js';
import { ALL_STORE_NAMES } from '../database/stores.js';
import { Repository } from '../database/Repository.js';
import {
  ARCHIVE_FORMAT,
  ARCHIVE_FORMAT_VERSION,
  toPortableRecord,
  computeArchiveChecksum,
} from './archiveCodec.js';

/**
 * Export the ENTIRE database — every store, every record, including
 * soft-delete tombstones and binary image data — as one archive.
 * @returns {Promise<{json: string, meta: object}>}
 */
export async function exportFull() {
  const collections = {};
  const counts = {};

  // Registry order keeps serialization deterministic (checksum stability).
  for (const storeName of ALL_STORE_NAMES) {
    const records = [];
    const keys = [];
    await new Repository(storeName).exportAll(async (batch, batchKeys) => {
      for (const record of batch) {
        records.push(await toPortableRecord(record));
      }
      keys.push(...batchKeys);
    });
    collections[storeName] = { records, keys };
    counts[storeName] = records.length;
  }

  const meta = {
    app: APP_NAME,
    appVersion: APP_VERSION,
    schemaVersion: DB_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    checksum: await computeArchiveChecksum(collections),
    counts,
  };

  const archive = {
    format: ARCHIVE_FORMAT,
    formatVersion: ARCHIVE_FORMAT_VERSION,
    meta,
    collections,
  };

  return { json: JSON.stringify(archive), meta };
}
