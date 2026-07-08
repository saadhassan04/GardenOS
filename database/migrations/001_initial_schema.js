/**
 * Migration 001 — initial schema (Data layer, L2) — DATABASE.md §2–§3.
 * Creates all seventeen object stores, including the reserved future stores
 * (analyses, weatherCache, sensorReadings, oplog), and every index listed
 * in DATABASE.md. Index names match their key paths; compound indexes join
 * key paths with "_".
 *
 * Note: IndexedDB cannot index boolean values, so indexed boolean-like
 * fields (notes.pinned, oplog.synced) are stored as 0/1 (DATABASE.md §5).
 */

export const migration001 = {
  version: 1,
  name: 'initial-schema',

  /**
   * @param {IDBDatabase} db
   */
  upgrade(db) {
    const plants = db.createObjectStore('plants', { keyPath: 'id' });
    plants.createIndex('category', 'category');
    plants.createIndex('status', 'status');
    plants.createIndex('locationId', 'locationId');
    plants.createIndex('parentPlantId', 'parentPlantId');
    plants.createIndex('name', 'name');
    plants.createIndex('status_category', ['status', 'category']);

    const events = db.createObjectStore('events', { keyPath: 'id' });
    events.createIndex('plantId', 'plantId');
    events.createIndex('type', 'type');
    events.createIndex('occurredAt', 'occurredAt');
    events.createIndex('batchId', 'batchId');
    events.createIndex('plantId_occurredAt', ['plantId', 'occurredAt']);
    events.createIndex('type_occurredAt', ['type', 'occurredAt']);

    const tasks = db.createObjectStore('tasks', { keyPath: 'id' });
    tasks.createIndex('status', 'status');
    tasks.createIndex('dueAt', 'dueAt');
    tasks.createIndex('seriesId', 'seriesId');
    tasks.createIndex('status_dueAt', ['status', 'dueAt']);
    tasks.createIndex('plantIds', 'plantIds', { multiEntry: true });

    const notes = db.createObjectStore('notes', { keyPath: 'id' });
    notes.createIndex('plantIds', 'plantIds', { multiEntry: true });
    notes.createIndex('tags', 'tags', { multiEntry: true });
    notes.createIndex('updatedAt', 'updatedAt');
    notes.createIndex('pinned', 'pinned');

    const images = db.createObjectStore('images', { keyPath: 'id' });
    images.createIndex('plantId', 'plantId');
    images.createIndex('eventId', 'eventId');
    images.createIndex('capturedAt', 'capturedAt');
    images.createIndex('plantId_capturedAt', ['plantId', 'capturedAt']);

    db.createObjectStore('thumbnails', { keyPath: 'imageId' });

    const sowingBatches = db.createObjectStore('sowingBatches', { keyPath: 'id' });
    sowingBatches.createIndex('crop', 'crop');
    sowingBatches.createIndex('stage', 'stage');
    sowingBatches.createIndex('sownAt', 'sownAt');
    sowingBatches.createIndex('stage_sownAt', ['stage', 'sownAt']);

    const harvests = db.createObjectStore('harvests', { keyPath: 'id' });
    harvests.createIndex('crop', 'crop');
    harvests.createIndex('harvestedAt', 'harvestedAt');
    harvests.createIndex('sowingBatchId', 'sowingBatchId');
    harvests.createIndex('plantId', 'plantId');
    harvests.createIndex('crop_harvestedAt', ['crop', 'harvestedAt']);

    const pestRecords = db.createObjectStore('pestRecords', { keyPath: 'id' });
    pestRecords.createIndex('pestType', 'pestType');
    pestRecords.createIndex('status', 'status');
    pestRecords.createIndex('plantIds', 'plantIds', { multiEntry: true });
    pestRecords.createIndex('observedAt', 'observedAt');

    const treatments = db.createObjectStore('treatments', { keyPath: 'id' });
    treatments.createIndex('pestRecordId', 'pestRecordId');
    treatments.createIndex('plantIds', 'plantIds', { multiEntry: true });
    treatments.createIndex('appliedAt', 'appliedAt');
    treatments.createIndex('product', 'product');

    const locations = db.createObjectStore('locations', { keyPath: 'id' });
    locations.createIndex('name', 'name');
    locations.createIndex('kind', 'kind');

    const careProfiles = db.createObjectStore('careProfiles', { keyPath: 'id' });
    careProfiles.createIndex('species', 'species');
    careProfiles.createIndex('name', 'name');

    db.createObjectStore('appMeta', { keyPath: 'key' });

    // ---- Reserved stores (DATABASE.md §3.14) ----
    const analyses = db.createObjectStore('analyses', { keyPath: 'id' });
    analyses.createIndex('imageId', 'imageId');
    analyses.createIndex('plantId', 'plantId');
    analyses.createIndex('kind', 'kind');

    db.createObjectStore('weatherCache', { keyPath: 'key' });

    const sensorReadings = db.createObjectStore('sensorReadings', { autoIncrement: true });
    sensorReadings.createIndex('sensorId_at', ['sensorId', 'at']);
    sensorReadings.createIndex('plantId_at', ['plantId', 'at']);

    const oplog = db.createObjectStore('oplog', { keyPath: 'seq', autoIncrement: true });
    oplog.createIndex('synced', 'synced');
  },
};
