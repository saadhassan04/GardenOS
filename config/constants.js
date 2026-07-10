/**
 * Application constants (Platform layer, L1).
 * Immutable values shared across all layers. No mutable state here.
 */

export const APP_NAME = 'GardenOS';

/** App version — bumped per increment, released per ROADMAP.md gates. */
export const APP_VERSION = '1.5.0-dev.2';

/** IndexedDB database name and current schema version (DATABASE.md). */
export const DB_NAME = 'gardenos';
export const DB_SCHEMA_VERSION = 1;

/** LocalStorage keys — the only keys the app may use (ADR-0002 §Decision 2). */
export const STORAGE_KEYS = Object.freeze({
  /** Kept in sync manually with scripts/theme-init.js (classic script). */
  settings: 'gardenos.settings.v1',
});

/** Storage quota warning thresholds (NFR-3.2). */
export const QUOTA_WARN_RATIO = 0.7;
export const QUOTA_DANGER_RATIO = 0.9;

/** Toast auto-dismiss duration in ms (UI_GUIDELINES.md §7). */
export const TOAST_DURATION_MS = 4000;
