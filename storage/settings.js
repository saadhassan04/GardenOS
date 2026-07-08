/**
 * Typed LocalStorage settings wrapper (Platform layer, L1) — ADR-0002.
 * The ONLY module that touches LocalStorage for settings. Domain data never
 * lives here (it belongs in IndexedDB). Emits "settings:changed" on the bus.
 */

import { bus } from '../hooks/bus.js';
import { logger } from '../utils/logger.js';
import { ValidationError } from '../utils/errors.js';
import { STORAGE_KEYS } from '../config/constants.js';

/**
 * Settings schema: every key declares its allowed values and default.
 * Adding a setting = adding one entry here; unknown/invalid stored values
 * fall back to defaults so a corrupt store can never break the app.
 */
const SCHEMA = Object.freeze({
  theme: { values: ['dark', 'light', 'auto'], defaultValue: 'dark' },
  units: { values: ['metric', 'imperial'], defaultValue: 'metric' },
  weekStart: { values: ['monday', 'sunday', 'saturday'], defaultValue: 'monday' },
});

function readRaw() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEYS.settings)) || {};
  } catch (error) {
    logger.warn('Settings store unreadable; using defaults', { error: error.message });
    return {};
  }
}

/**
 * Get one validated setting.
 * @param {keyof typeof SCHEMA} key
 * @returns {string}
 */
export function getSetting(key) {
  const spec = SCHEMA[key];
  if (!spec) {
    throw new ValidationError(`Unknown setting "${key}"`);
  }
  const stored = readRaw()[key];
  return spec.values.includes(stored) ? stored : spec.defaultValue;
}

/** @returns {Record<string, string>} all effective settings (validated). */
export function getAllSettings() {
  const settings = {};
  for (const key of Object.keys(SCHEMA)) {
    settings[key] = getSetting(key);
  }
  return settings;
}

/**
 * Set one setting and notify subscribers via "settings:changed".
 * @param {keyof typeof SCHEMA} key
 * @param {string} value must be one of the schema's allowed values
 */
export function setSetting(key, value) {
  const spec = SCHEMA[key];
  if (!spec) {
    throw new ValidationError(`Unknown setting "${key}"`);
  }
  if (!spec.values.includes(value)) {
    throw new ValidationError(`Invalid value "${value}" for setting "${key}"`, {
      details: { allowed: spec.values },
    });
  }
  const raw = readRaw();
  raw[key] = value;
  window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(raw));
  bus.emit('settings:changed', { key, value });
}
