/**
 * Integration tests: migration 001 + Repository base against REAL IndexedDB
 * (CONTRIBUTING.md §7: repository code is tested against the real engine,
 * not mocks). Runs in tests/index.html against a disposable database.
 */

import { test, assert, assertEqual, assertThrows } from './testKit.js';
import { configureDatabase, openDatabase, getAppMeta } from '../database/db.js';
import { ALL_STORE_NAMES, STORES } from '../database/stores.js';
import { Repository } from '../database/Repository.js';
import { RECORD_SCHEMA_VERSION } from '../models/envelope.js';
import { NotFoundError, StorageError, ValidationError } from '../utils/errors.js';
import { DB_SCHEMA_VERSION } from '../config/constants.js';

const TEST_DB = 'gardenos-test';

/** Must run before the first openDatabase() call anywhere. */
export async function prepareTestDatabase() {
  configureDatabase({ name: TEST_DB });
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(TEST_DB);
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve(); // stale tab holds it; delete proceeds on close
    request.onerror = () => reject(request.error);
  });
}

const plants = new Repository(STORES.plants);
const events = new Repository(STORES.events);

test('should create every registered object store when migration 001 runs', async () => {
  const db = await openDatabase();
  for (const name of ALL_STORE_NAMES) {
    assert(db.objectStoreNames.contains(name), `missing store "${name}"`);
  }
  assertEqual(db.objectStoreNames.length, ALL_STORE_NAMES.length, 'unexpected extra stores');
});

test('should record install metadata and schema version in appMeta', async () => {
  const meta = await getAppMeta();
  assertEqual(meta.schemaVersion, DB_SCHEMA_VERSION);
  assert(typeof meta.installId === 'string' && meta.installId.length > 0, 'installId missing');
  assert(typeof meta.installedAt === 'string', 'installedAt missing');
  assert(Array.isArray(meta.migrationLog) && meta.migrationLog.length === 1, 'migrationLog missing');
  assertEqual(meta.migrationLog[0].from, 0);
  assertEqual(meta.migrationLog[0].to, DB_SCHEMA_VERSION);
});

test('should stamp the full envelope when adding a record', async () => {
  const added = await plants.add({ name: 'Black Plumeria', category: 'flower' });
  assert(typeof added.id === 'string' && added.id.length >= 36, 'id not stamped');
  assertEqual(added.schemaVersion, RECORD_SCHEMA_VERSION);
  assert(added.createdAt && added.updatedAt, 'timestamps not stamped');
  assertEqual(added.deletedAt, null);
  const fetched = await plants.get(added.id);
  assertEqual(fetched.name, 'Black Plumeria');
});

test('should reject duplicate ids and keep addMany atomic', async () => {
  const existing = await plants.add({ name: 'Rose' });
  await assertThrows(() => plants.add({ id: existing.id, name: 'Impostor Rose' }), StorageError);

  const before = await plants.count();
  // Second record collides → the WHOLE batch must roll back (NFR-4.1).
  await assertThrows(
    () => plants.addMany([{ name: 'Jasmine' }, { id: existing.id, name: 'Impostor' }]),
    StorageError,
  );
  assertEqual(await plants.count(), before, 'atomicity violated: partial batch persisted');
  await assertThrows(() => plants.addMany([]), ValidationError);
});

test('should hide soft-deleted records unless includeDeleted is passed', async () => {
  const plant = await plants.add({ name: 'Tulsi', category: 'herb' });
  await plants.softDelete(plant.id);

  assertEqual(await plants.get(plant.id), null, 'tombstone leaked through get()');
  const revealed = await plants.get(plant.id, { includeDeleted: true });
  assert(revealed && typeof revealed.deletedAt === 'string', 'tombstone not readable when asked');

  await plants.softDelete(plant.id); // idempotent — must not throw
  await assertThrows(() => plants.softDelete('no-such-id'), NotFoundError);
});

test('should merge patches on update while preserving id and createdAt', async () => {
  const plant = await plants.add({ name: 'Money Plant', category: 'indoor' });
  const updated = await plants.update(plant.id, {
    name: 'Money Plant (balcony)',
    id: 'attempted-id-change',
    createdAt: '1999-01-01T00:00:00.000Z',
  });
  assertEqual(updated.id, plant.id, 'id must be immutable');
  assertEqual(updated.createdAt, plant.createdAt, 'createdAt must be immutable');
  assertEqual(updated.name, 'Money Plant (balcony)');
  assertEqual(updated.category, 'indoor', 'unpatched fields must survive');
  assert(updated.updatedAt >= plant.updatedAt, 'updatedAt not refreshed');
  await assertThrows(() => plants.update('no-such-id', { name: 'x' }), NotFoundError);
});

test('should remove records physically with hardDelete', async () => {
  const plant = await plants.add({ name: 'Ephemeral Fern' });
  await plants.hardDelete(plant.id);
  assertEqual(await plants.get(plant.id, { includeDeleted: true }), null);
});

test('should paginate an indexed, descending query with cursors', async () => {
  const plant = await plants.add({ name: 'Bougainvillea' });
  const days = ['01', '02', '03', '04', '05', '06', '07'];
  await events.addMany(
    days.map((day) => ({
      plantId: plant.id,
      type: 'watering',
      occurredAt: `2026-07-${day}T06:00:00.000Z`,
    })),
  );

  // Timeline query: [plantId+occurredAt] descending (DATABASE.md §6).
  const range = IDBKeyRange.bound([plant.id, ''], [plant.id, '￿']);
  const base = { index: 'plantId_occurredAt', range, direction: 'prev', limit: 3 };

  const page1 = await events.query(base);
  assertEqual(page1.items.map((e) => e.occurredAt.slice(8, 10)), ['07', '06', '05']);
  assert(page1.nextCursor !== null, 'expected a continuation cursor');

  const page2 = await events.query({ ...base, cursor: page1.nextCursor });
  assertEqual(page2.items.map((e) => e.occurredAt.slice(8, 10)), ['04', '03', '02']);

  const page3 = await events.query({ ...base, cursor: page2.nextCursor });
  assertEqual(page3.items.map((e) => e.occurredAt.slice(8, 10)), ['01']);
  assertEqual(page3.nextCursor, null, 'final page must end the cursor chain');
});

test('should skip tombstones in query results but count them in exportAll', async () => {
  const notes = new Repository(STORES.notes);
  const [keep, drop] = await notes.addMany([
    { title: 'Keep me', pinned: 0 },
    { title: 'Tombstone me', pinned: 0 },
  ]);
  await notes.softDelete(drop.id);

  const { items } = await notes.query({ limit: 100 });
  assert(items.some((n) => n.id === keep.id), 'live record missing from query');
  assert(!items.some((n) => n.id === drop.id), 'tombstone leaked into query');

  const exported = [];
  await notes.exportAll((batch) => exported.push(...batch), { batchSize: 1 });
  assert(exported.some((n) => n.id === drop.id), 'exportAll must include tombstones');
  assertEqual(exported.length, await notes.count(), 'exportAll must stream every record');
});

test('should import with merge and replace semantics', async () => {
  const locations = new Repository(STORES.locations);
  const original = await locations.add({ name: 'East Balcony', kind: 'balcony' });

  await locations.importBatch(
    [{ ...original, name: 'East Balcony (renamed)' }],
    { mode: 'merge' },
  );
  assertEqual((await locations.get(original.id)).name, 'East Balcony (renamed)');

  await locations.importBatch(
    [{ ...original, id: 'imported-1', name: 'Rooftop', kind: 'rooftop' }],
    { mode: 'replace' },
  );
  assertEqual(await locations.count(), 1, 'replace mode must clear the store first');
  assertEqual(await locations.get(original.id), null);
  assertEqual((await locations.get('imported-1')).name, 'Rooftop');

  await assertThrows(() => locations.importBatch([], { mode: 'sideways' }), ValidationError);
});
