/**
 * Sowing calendar service (Business layer, L3) — FR-5.4, T-063.
 * Merges the Karachi seed calendar with user-added crops (stored as an
 * appMeta row — reference data, not a domain collection). Seed entries are
 * code-defined and always current; user entries survive backups via appMeta
 * export (informational) and are device-local like other appMeta rows.
 */

import { KARACHI_SOWING_CALENDAR } from '../database/seed/sowingCalendar.karachi.js';
import { openDatabase } from '../database/db.js';
import { promisify, transactionDone } from '../database/idb.js';
import { STORES } from '../database/stores.js';
import { ValidationError } from '../utils/errors.js';
import { bus } from '../hooks/bus.js';

const CUSTOM_ROW_KEY = 'customSowingCrops';

/** @returns {Promise<object[]>} user-added calendar entries */
export async function listCustomCrops() {
  const db = await openDatabase();
  const store = db.transaction(STORES.appMeta, 'readonly').objectStore(STORES.appMeta);
  const row = await promisify(store.get(CUSTOM_ROW_KEY));
  return row?.value ?? [];
}

/**
 * Add or replace a user calendar entry (matched case-insensitively by crop).
 * @param {{crop: string, months: number[], notes?: string}} input
 */
export async function saveCustomCrop(input) {
  const crop = typeof input.crop === 'string' ? input.crop.trim() : '';
  if (!crop) {
    throw new ValidationError('The crop needs a name');
  }
  const months = Array.isArray(input.months)
    ? [...new Set(input.months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b)
    : [];
  if (months.length === 0) {
    throw new ValidationError('Give at least one sowing month (1–12)');
  }

  const entry = { crop, months, notes: (input.notes ?? '').trim(), custom: true };
  const db = await openDatabase();
  const tx = db.transaction(STORES.appMeta, 'readwrite');
  const store = tx.objectStore(STORES.appMeta);
  const row = (await promisify(store.get(CUSTOM_ROW_KEY))) ?? { key: CUSTOM_ROW_KEY, value: [] };
  row.value = row.value.filter((e) => e.crop.toLowerCase() !== crop.toLowerCase());
  row.value.push(entry);
  store.put(row);
  await transactionDone(tx);
  bus.emit('sowingCalendar:changed', { crop });
  return entry;
}

/** @param {string} crop remove a user entry (seed entries can't be removed) */
export async function removeCustomCrop(crop) {
  const db = await openDatabase();
  const tx = db.transaction(STORES.appMeta, 'readwrite');
  const store = tx.objectStore(STORES.appMeta);
  const row = await promisify(store.get(CUSTOM_ROW_KEY));
  if (row) {
    row.value = row.value.filter((e) => e.crop.toLowerCase() !== crop.trim().toLowerCase());
    store.put(row);
  }
  await transactionDone(tx);
  bus.emit('sowingCalendar:changed', { crop });
}

/**
 * What to sow in a given month, Karachi-tuned (FR-5.4).
 * @param {number} [month] 1–12, defaults to the current month
 * @returns {Promise<object[]>} seed + custom entries, name-sorted
 */
export async function getSowingSuggestions(month = new Date().getMonth() + 1) {
  const custom = await listCustomCrops();
  return [...KARACHI_SOWING_CALENDAR, ...custom]
    .filter((entry) => entry.months.includes(month))
    .sort((a, b) => a.crop.localeCompare(b.crop));
}

/** Every known crop name (sowing form suggestions). */
export async function listAllCropNames() {
  const custom = await listCustomCrops();
  return [...new Set([...KARACHI_SOWING_CALENDAR, ...custom].map((e) => e.crop))].sort();
}
