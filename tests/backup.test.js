/**
 * Backup round-trip tests — RELEASE-BLOCKING (CONTRIBUTING.md §6.2).
 * export → wipe → restore must reproduce the exact dataset, including
 * binary blobs and soft-delete tombstones, and every tamper/mismatch gate
 * must refuse to restore. Runs after database.test.js in the same
 * disposable "gardenos-test" database.
 */

import { test, assert, assertEqual, assertThrows } from './testKit.js';
import { getAppMeta } from '../database/db.js';
import { ALL_STORE_NAMES, STORES } from '../database/stores.js';
import { Repository } from '../database/Repository.js';
import { exportFull } from '../services/exportService.js';
import { inspectArchive, importCollections } from '../services/importService.js';
import { createBackup, restoreFromArchive } from '../services/backupService.js';
import { ValidationError } from '../utils/errors.js';

const BLOB_BYTES = [1, 2, 3, 0, 255, 250, 128];

async function clearDomainStores() {
  for (const name of ALL_STORE_NAMES) {
    if (name !== STORES.appMeta) {
      await new Repository(name).clearAll();
    }
  }
}

/** Seed a small but representative garden across record shapes. */
async function seedFixture() {
  const plants = new Repository(STORES.plants);
  const events = new Repository(STORES.events);
  const notes = new Repository(STORES.notes);
  const images = new Repository(STORES.images);

  const alive = await plants.add({ name: 'Thai Plumeria', category: 'flower' });
  const dead = await plants.add({ name: 'Old Basil', category: 'herb' });
  await plants.softDelete(dead.id);

  await events.addMany([
    { plantId: alive.id, type: 'watering', occurredAt: '2026-07-01T06:00:00.000Z' },
    { plantId: alive.id, type: 'fertilizing', occurredAt: '2026-07-05T06:00:00.000Z' },
  ]);
  await notes.add({ title: 'Monsoon prep', body: 'Check drainage holes', pinned: 1 });
  const image = await images.add({
    plantId: alive.id,
    blob: new Blob([new Uint8Array(BLOB_BYTES)], { type: 'image/webp' }),
    mimeType: 'image/webp',
    byteSize: BLOB_BYTES.length,
    width: 1,
    height: 1,
    capturedAt: '2026-07-06T09:00:00.000Z',
  });

  return { alive, dead, image };
}

test('should round-trip export → wipe → restore, preserving blobs and tombstones', async () => {
  await clearDomainStores();
  const { alive, dead, image } = await seedFixture();

  const { json, meta } = await exportFull();
  assertEqual(meta.counts[STORES.plants], 2, 'tombstoned plant must be exported too');
  assertEqual(meta.counts[STORES.images], 1);

  const inspection = await inspectArchive(json);
  assert(inspection.checksumOk, 'freshly exported archive must pass its own checksum');
  assertEqual(inspection.meta.checksum, meta.checksum);

  await clearDomainStores(); // simulate a wiped device
  assertEqual(await new Repository(STORES.plants).count(), 0, 'wipe failed');

  await restoreFromArchive(inspection.archive, inspection.checksumOk);

  const plants = new Repository(STORES.plants);
  const restoredAlive = await plants.get(alive.id);
  assertEqual(restoredAlive, alive, 'restored record must be byte-for-byte identical');

  const restoredDead = await plants.get(dead.id, { includeDeleted: true });
  assert(restoredDead && restoredDead.deletedAt, 'tombstone lost in round-trip');
  assertEqual(await plants.get(dead.id), null, 'tombstone must stay hidden after restore');

  const restoredImage = await new Repository(STORES.images).get(image.id);
  assert(restoredImage.blob instanceof Blob, 'blob field must revive as a Blob');
  assertEqual(restoredImage.blob.type, 'image/webp');
  const bytes = Array.from(new Uint8Array(await restoredImage.blob.arrayBuffer()));
  assertEqual(bytes, BLOB_BYTES, 'blob bytes corrupted in round-trip');

  assertEqual(await new Repository(STORES.events).count(), 2);
  assertEqual(await new Repository(STORES.notes).count(), 1);
});

test('should refuse to restore a tampered archive', async () => {
  await clearDomainStores();
  await seedFixture();

  const { json } = await exportFull();
  const tampered = JSON.parse(json);
  tampered.collections.plants.records[0].name = 'Tampered Plumeria';

  const inspection = await inspectArchive(JSON.stringify(tampered));
  assertEqual(inspection.checksumOk, false, 'tampering must break the checksum');
  await assertThrows(
    () => restoreFromArchive(inspection.archive, inspection.checksumOk),
    ValidationError,
  );
});

test('should refuse archives from a different schema version or foreign files', async () => {
  const { json } = await exportFull();
  const foreignSchema = JSON.parse(json);
  foreignSchema.meta.schemaVersion = 999;
  // Checksum only covers collections, so it still passes — the schema gate
  // must refuse independently.
  const inspection = await inspectArchive(JSON.stringify(foreignSchema));
  assert(inspection.checksumOk, 'precondition: checksum unaffected by meta edit');
  await assertThrows(
    () => restoreFromArchive(inspection.archive, inspection.checksumOk),
    ValidationError,
  );

  await assertThrows(() => inspectArchive('{"format":"other-app"}'), ValidationError);
  await assertThrows(() => inspectArchive('not json at all'), ValidationError);
  await assertThrows(
    () => inspectArchive(JSON.stringify({ format: 'gardenos-backup', formatVersion: 99, meta: {}, collections: {} })),
    ValidationError,
  );
});

test('should keep this device\'s appMeta identity across a restore', async () => {
  await clearDomainStores();
  await seedFixture();
  const before = await getAppMeta();

  const { json } = await exportFull();
  const inspection = await inspectArchive(json);
  await restoreFromArchive(inspection.archive, inspection.checksumOk);

  const after = await getAppMeta();
  assertEqual(after.installId, before.installId, 'restore must not adopt the archive installId');
  assertEqual(after.installedAt, before.installedAt);
  assert(typeof after.lastRestoreAt === 'string', 'restore must record lastRestoreAt');
});

test('should record backup bookkeeping when createBackup runs', async () => {
  const { blob, filename, meta } = await createBackup();
  assert(blob instanceof Blob && blob.size > 0, 'backup blob missing');
  assert(/^gardenos-backup-.*\.json$/.test(filename), `unexpected filename ${filename}`);

  const appMeta = await getAppMeta();
  assertEqual(appMeta.lastBackupAt, meta.createdAt);
  const history = appMeta.backupHistory ?? [];
  assert(history.length >= 1, 'backupHistory not recorded');
  assertEqual(history[history.length - 1].checksum, meta.checksum);
  assertEqual(history[history.length - 1].byteSize, blob.size);
});

test('should merge without clearing when importCollections uses merge mode', async () => {
  await clearDomainStores();
  const plants = new Repository(STORES.plants);
  await seedFixture();
  const { json } = await exportFull();
  const inspection = await inspectArchive(json);

  const extra = await plants.add({ name: 'Post-backup Rose', category: 'flower' });
  await importCollections(inspection.archive, { mode: 'merge' });

  assert(await plants.get(extra.id), 'merge mode must keep records missing from the archive');
  assertEqual(await plants.count(), 3, 'merge should re-put archived records over same ids');
});
