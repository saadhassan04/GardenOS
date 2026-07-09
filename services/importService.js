/**
 * Import service (Business layer, L3) — API_DESIGN.md §7, FR-9.2/9.3, T-023.
 * Validates archives BEFORE any data is touched (inspect), then imports all
 * collections in ONE IndexedDB transaction spanning every store — an import
 * either fully commits or leaves the database exactly as it was (NFR-4.1).
 *
 * appMeta is deliberately never imported: install identity, backup history,
 * and migration log belong to THIS device, not the archive's source device.
 */

import { openDatabase } from '../database/db.js';
import { transactionDone } from '../database/idb.js';
import { ALL_STORE_NAMES, STORES } from '../database/stores.js';
import { ValidationError } from '../utils/errors.js';
import {
  ARCHIVE_FORMAT,
  ARCHIVE_FORMAT_VERSION,
  fromPortableRecord,
  computeArchiveChecksum,
} from './archiveCodec.js';

/**
 * Parse and validate an archive without touching the database (NFR-4.4).
 * @param {string} text raw archive file contents
 * @returns {Promise<{archive: object, meta: object, checksumOk: boolean}>}
 * @throws {ValidationError} when the file is not a GardenOS backup at all
 */
export async function inspectArchive(text) {
  let archive;
  try {
    archive = JSON.parse(text);
  } catch {
    throw new ValidationError('This file is not valid JSON — not a GardenOS backup');
  }

  if (archive?.format !== ARCHIVE_FORMAT) {
    throw new ValidationError('This file is not a GardenOS backup archive');
  }
  if (archive.formatVersion !== ARCHIVE_FORMAT_VERSION) {
    throw new ValidationError(
      `Unsupported archive format version ${archive.formatVersion} (this app reads version ${ARCHIVE_FORMAT_VERSION})`,
    );
  }
  if (!archive.meta || typeof archive.collections !== 'object' || archive.collections === null) {
    throw new ValidationError('Backup archive is malformed: missing meta or collections');
  }
  for (const name of Object.keys(archive.collections)) {
    if (!ALL_STORE_NAMES.includes(name)) {
      throw new ValidationError(`Backup archive contains an unknown collection "${name}"`);
    }
  }

  const checksumOk =
    (await computeArchiveChecksum(archive.collections)) === archive.meta.checksum;

  return { archive, meta: archive.meta, checksumOk };
}

/**
 * Import an inspected archive's collections in one atomic transaction.
 * @param {object} archive a validated archive from inspectArchive()
 * @param {{mode?: 'merge'|'replace'}} [options]
 *   replace: every store (except appMeta) is cleared first — full restore.
 *   merge: records are put over existing data (same-id wins from archive).
 * @returns {Promise<Record<string, number>>} imported record count per store
 */
export async function importCollections(archive, { mode = 'replace' } = {}) {
  if (mode !== 'merge' && mode !== 'replace') {
    throw new ValidationError(`Unknown import mode "${mode}"`);
  }

  const targetNames = ALL_STORE_NAMES.filter((name) => name !== STORES.appMeta);
  const db = await openDatabase();
  const tx = db.transaction(targetNames, 'readwrite');
  const imported = {};

  for (const name of targetNames) {
    const store = tx.objectStore(name);
    if (mode === 'replace') {
      store.clear();
    }
    const entry = archive.collections[name];
    if (!entry || entry.records.length === 0) {
      imported[name] = 0;
      continue;
    }
    const outOfLineKeys = store.keyPath === null;
    entry.records.forEach((portable, i) => {
      const record = fromPortableRecord(portable);
      if (outOfLineKeys) {
        store.put(record, entry.keys[i]);
      } else {
        store.put(record);
      }
    });
    imported[name] = entry.records.length;
  }

  await transactionDone(tx);
  return imported;
}
