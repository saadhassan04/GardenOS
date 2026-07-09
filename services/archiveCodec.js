/**
 * Backup archive codec (Business layer, L3) — API_DESIGN.md §7, TODO T-022.
 * Defines the open, versioned, single-JSON-file archive format shared by
 * export (build) and import (parse/validate). Blob fields survive the text
 * round-trip as marked base64 objects; out-of-line primary keys are
 * preserved alongside records.
 *
 * Format v1:
 * {
 *   format: "gardenos-backup",
 *   formatVersion: 1,
 *   meta: { app, appVersion, schemaVersion, createdAt, checksum, counts },
 *   collections: { <storeName>: { records: [...], keys: [...] }, ... }
 * }
 * meta.checksum = SHA-256 hex of JSON.stringify(collections). Collections
 * are built in database/stores.js registry order, so the serialization is
 * deterministic for a given dataset.
 */

import { sha256Hex } from '../utils/checksum.js';
import { blobToBase64, base64ToBlob } from '../utils/blobCodec.js';

export const ARCHIVE_FORMAT = 'gardenos-backup';
export const ARCHIVE_FORMAT_VERSION = 1;

/** Marker key for serialized Blob fields inside archived records. */
const BLOB_MARKER = '__gardenosBlob';

/**
 * Make a record JSON-safe: top-level Blob fields (images.blob,
 * thumbnails.blob — DATABASE.md §3.5) become marked base64 objects.
 * @param {object} record
 * @returns {Promise<object>} the original record if no blobs, else a copy
 */
export async function toPortableRecord(record) {
  let portable = record;
  for (const [key, value] of Object.entries(record)) {
    if (value instanceof Blob) {
      if (portable === record) {
        portable = { ...record };
      }
      portable[key] = { [BLOB_MARKER]: { base64: await blobToBase64(value), type: value.type } };
    }
  }
  return portable;
}

/**
 * Reverse of toPortableRecord: revive marked base64 objects into Blobs.
 * @param {object} record
 * @returns {object}
 */
export function fromPortableRecord(record) {
  let revived = record;
  for (const [key, value] of Object.entries(record)) {
    if (value && typeof value === 'object' && BLOB_MARKER in value) {
      if (revived === record) {
        revived = { ...record };
      }
      revived[key] = base64ToBlob(value[BLOB_MARKER].base64, value[BLOB_MARKER].type);
    }
  }
  return revived;
}

/**
 * Integrity checksum over the collections payload.
 * @param {object} collections
 * @returns {Promise<string>}
 */
export function computeArchiveChecksum(collections) {
  return sha256Hex(JSON.stringify(collections));
}
