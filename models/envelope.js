/**
 * Record envelope (Data layer, L2) — DATABASE.md §1.2, ARCHITECTURE.md D5.
 * Every domain record carries: id (UUIDv4), schemaVersion, createdAt,
 * updatedAt, deletedAt. Stamped here, in exactly one place.
 */

import { uuid } from '../utils/uuid.js';
import { ValidationError } from '../utils/errors.js';

/**
 * Record-level schema version, enabling lazy per-record upgrades without
 * full-table rewrites (DATABASE.md §7.4). Independent of the database-level
 * schema version in config/constants.js.
 */
export const RECORD_SCHEMA_VERSION = 1;

/**
 * Stamp a new record with the envelope. Provided id/createdAt are preserved
 * (required for backup restore and import, where records keep their history).
 * @param {object} record
 * @returns {object} a new stamped object; the input is not mutated
 */
export function stampNew(record) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new ValidationError('A record must be a plain object');
  }
  const now = new Date().toISOString();
  return {
    deletedAt: null,
    ...record,
    id: record.id ?? uuid(),
    schemaVersion: record.schemaVersion ?? RECORD_SCHEMA_VERSION,
    createdAt: record.createdAt ?? now,
    updatedAt: now,
  };
}

/**
 * Mark a record as modified now.
 * @param {object} record
 * @returns {object} a new object with a fresh updatedAt
 */
export function touch(record) {
  return { ...record, updatedAt: new Date().toISOString() };
}
