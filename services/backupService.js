/**
 * Backup service (Business layer, L3) — API_DESIGN.md §8, FR-9, T-024/T-025.
 * Orchestrates backup creation (with appMeta bookkeeping), the guarded
 * restore pipeline, and backup-reminder status. DOM-free: file download and
 * confirmation UI belong to the Settings page.
 */

import { DB_SCHEMA_VERSION } from '../config/constants.js';
import { openDatabase, getAppMeta, getStoreCounts } from '../database/db.js';
import { transactionDone, promisify } from '../database/idb.js';
import { STORES } from '../database/stores.js';
import { bus } from '../hooks/bus.js';
import { logger } from '../utils/logger.js';
import { ValidationError, StorageError } from '../utils/errors.js';
import { getSetting } from '../storage/settings.js';
import { exportFull } from './exportService.js';
import { importCollections } from './importService.js';

/** Backup history entries kept in appMeta (DATABASE.md §3.13). */
const HISTORY_LIMIT = 20;

/**
 * Create a full backup and record it in appMeta.
 * @returns {Promise<{blob: Blob, filename: string, meta: object}>}
 */
export async function createBackup() {
  const { json, meta } = await exportFull();
  const blob = new Blob([json], { type: 'application/json' });
  const stamp = meta.createdAt.slice(0, 16).replace(/[T:]/g, '-');
  const filename = `gardenos-backup-${stamp}.json`;

  const db = await openDatabase();
  const tx = db.transaction(STORES.appMeta, 'readwrite');
  const store = tx.objectStore(STORES.appMeta);
  store.put({ key: 'lastBackupAt', value: meta.createdAt });
  const historyRow = (await promisify(store.get('backupHistory'))) ?? { key: 'backupHistory', value: [] };
  historyRow.value.push({ at: meta.createdAt, byteSize: blob.size, checksum: meta.checksum });
  historyRow.value = historyRow.value.slice(-HISTORY_LIMIT);
  store.put(historyRow);
  await transactionDone(tx);

  logger.info(`Backup created (${blob.size} bytes)`);
  bus.emit('backup:created', { byteSize: blob.size, createdAt: meta.createdAt });
  return { blob, filename, meta };
}

/**
 * Restore a validated archive, replacing ALL current data atomically.
 * Callers must have run inspectArchive() and obtained user confirmation;
 * this function enforces the technical gates regardless (NFR-4.4).
 * @param {object} archive from inspectArchive()
 * @param {boolean} checksumOk from inspectArchive()
 * @returns {Promise<{imported: Record<string, number>}>}
 */
export async function restoreFromArchive(archive, checksumOk) {
  if (!checksumOk) {
    throw new ValidationError('Backup failed its integrity check — refusing to restore');
  }
  // v1 policy: exact schema match. Future app versions will migrate older
  // archives through the same migration chain (DATABASE.md §7.5); restoring
  // a NEWER archive into an older app is refused permanently.
  if (archive.meta.schemaVersion !== DB_SCHEMA_VERSION) {
    throw new ValidationError(
      `This backup uses schema version ${archive.meta.schemaVersion}; this app uses ${DB_SCHEMA_VERSION}. Update GardenOS, then restore.`,
    );
  }

  const imported = await importCollections(archive, { mode: 'replace' });

  // Post-commit verification: live counts must match what the archive
  // promised (duplicate ids inside a hand-edited archive would shrink here).
  const counts = await getStoreCounts();
  for (const [name, expected] of Object.entries(archive.meta.counts)) {
    if (name === STORES.appMeta) {
      continue;
    }
    if (counts[name] !== expected) {
      throw new StorageError(
        `Restore verification failed for "${name}": expected ${expected} records, found ${counts[name]}. Restore a different backup.`,
      );
    }
  }

  const db = await openDatabase();
  const tx = db.transaction(STORES.appMeta, 'readwrite');
  tx.objectStore(STORES.appMeta).put({ key: 'lastRestoreAt', value: new Date().toISOString() });
  await transactionDone(tx);

  logger.info('Backup restored', { imported });
  bus.emit('backup:restored', { imported });
  return { imported };
}

/**
 * Backup freshness for Settings display and the boot-time reminder (FR-9.4).
 * @returns {Promise<{lastBackupAt: string|null, daysSince: number|null,
 *                    dataRecords: number, reminderDue: boolean}>}
 */
export async function getBackupStatus() {
  const meta = await getAppMeta();
  const counts = await getStoreCounts();
  const dataRecords = Object.entries(counts)
    .filter(([name]) => name !== STORES.appMeta)
    .reduce((sum, [, count]) => sum + count, 0);

  const lastBackupAt = meta.lastBackupAt ?? null;
  const daysSince = lastBackupAt
    ? Math.floor((Date.now() - Date.parse(lastBackupAt)) / 86_400_000)
    : null;

  const reminderSetting = getSetting('backupReminderDays');
  const reminderDue =
    reminderSetting !== 'off'
    && dataRecords > 0
    && (daysSince === null || daysSince >= Number(reminderSetting));

  return { lastBackupAt, daysSince, dataRecords, reminderDue };
}
