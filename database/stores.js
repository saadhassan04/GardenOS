/**
 * Object store registry (Data layer, L2) — DATABASE.md §2.
 * The single source of truth for store names. Migrations, repositories,
 * diagnostics, and (later) backup all consume this list; a store that is
 * not registered here does not exist.
 */

export const STORES = Object.freeze({
  plants: 'plants',
  events: 'events',
  tasks: 'tasks',
  notes: 'notes',
  images: 'images',
  thumbnails: 'thumbnails',
  sowingBatches: 'sowingBatches',
  harvests: 'harvests',
  pestRecords: 'pestRecords',
  treatments: 'treatments',
  locations: 'locations',
  careProfiles: 'careProfiles',
  appMeta: 'appMeta',
  // Reserved stores — created empty at schema v1 so future versions need
  // data seeding, not structural migration (DATABASE.md §3.14).
  analyses: 'analyses',
  weatherCache: 'weatherCache',
  sensorReadings: 'sensorReadings',
  oplog: 'oplog',
});

/** All store names, for migrations/diagnostics/backup iteration. */
export const ALL_STORE_NAMES = Object.freeze(Object.values(STORES));
