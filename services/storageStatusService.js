/**
 * Storage status service (Business layer, L3) — NFR-3.2, TODO T-020.
 * Wraps the StorageManager platform API: quota estimation, persistence
 * state, and warning-level classification. Emits "storage:quota-warning"
 * when usage crosses the configured thresholds.
 */

import { bus } from '../hooks/bus.js';
import { logger } from '../utils/logger.js';
import { QUOTA_WARN_RATIO, QUOTA_DANGER_RATIO } from '../config/constants.js';

/**
 * @typedef {object} StorageStatus
 * @property {number|null} usageBytes
 * @property {number|null} quotaBytes
 * @property {number|null} ratio 0..1, null when the platform can't estimate
 * @property {'ok'|'warn'|'danger'|'unknown'} level
 * @property {boolean|null} persisted null when the API is unavailable
 */

/** @returns {Promise<StorageStatus>} */
export async function getStorageStatus() {
  let usageBytes = null;
  let quotaBytes = null;
  let ratio = null;
  let persisted = null;

  if (navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usageBytes = estimate.usage ?? null;
      quotaBytes = estimate.quota ?? null;
      if (usageBytes !== null && quotaBytes) {
        ratio = usageBytes / quotaBytes;
      }
    } catch (error) {
      logger.warn('Storage estimate failed', { error: error.message });
    }
  }

  if (navigator.storage?.persisted) {
    try {
      persisted = await navigator.storage.persisted();
    } catch (error) {
      logger.warn('Storage persisted() check failed', { error: error.message });
    }
  }

  const level =
    ratio === null
      ? 'unknown'
      : ratio >= QUOTA_DANGER_RATIO
        ? 'danger'
        : ratio >= QUOTA_WARN_RATIO
          ? 'warn'
          : 'ok';

  if (level === 'warn' || level === 'danger') {
    bus.emit('storage:quota-warning', { ratio, level });
  }

  return { usageBytes, quotaBytes, ratio, level, persisted };
}

/**
 * Ask the browser to protect our data from automatic eviction (ADR-0002).
 * Safe to call repeatedly; browsers may show a prompt or decide silently.
 * @returns {Promise<boolean|null>} granted state, null if unsupported
 */
export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) {
    return null;
  }
  try {
    const granted = await navigator.storage.persist();
    logger.info(`Persistent storage ${granted ? 'granted' : 'not granted'}`);
    return granted;
  } catch (error) {
    logger.warn('Persistent storage request failed', { error: error.message });
    return null;
  }
}
