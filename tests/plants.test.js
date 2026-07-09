/**
 * Plant Manager integration tests — models, services, derived caches,
 * bulk logging + undo, timeline, and the permanent-delete cascade.
 * Runs in the shared disposable "gardenos-test" database after the
 * database and backup suites.
 */

import { test, assert, assertEqual, assertThrows } from './testKit.js';
import { STORES } from '../database/stores.js';
import { Repository } from '../database/Repository.js';
import {
  createPlant,
  updatePlant,
  setPlantStatus,
  getPlant,
  listPlants,
  deletePlantPermanently,
} from '../services/plantService.js';
import {
  logEvent,
  logBulk,
  getTimeline,
  undoBatch,
} from '../services/careEventService.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

async function clearPlantStores() {
  await new Repository(STORES.plants).clearAll();
  await new Repository(STORES.events).clearAll();
}

test('should validate plant input when creating', async () => {
  await clearPlantStores();

  await assertThrows(() => createPlant({}), ValidationError);
  await assertThrows(() => createPlant({ name: '   ' }), ValidationError);
  await assertThrows(() => createPlant({ name: 'X', category: 'cactus-farm' }), ValidationError);
  await assertThrows(
    () => createPlant({ name: 'X', container: { type: 'clay-pot', sizeInches: -3 } }),
    ValidationError,
  );

  const plant = await createPlant({ name: '  Black Plumeria  ', category: 'flower' });
  assertEqual(plant.name, 'Black Plumeria', 'name must be trimmed');
  assertEqual(plant.status, 'active');
  assertEqual(plant.derived.eventCount, 0);
  assertEqual(plant.location.sunExposure, null);
});

test('should re-validate merged records on update and protect derived caches', async () => {
  const plant = await createPlant({ name: 'Curry Leaf', category: 'herb' });
  await logEvent(plant.id, 'watering');

  const updated = await updatePlant(plant.id, {
    botanicalName: 'Murraya koenigii',
    derived: { eventCount: 999 }, // must be ignored — service owns derived
  });
  assertEqual(updated.botanicalName, 'Murraya koenigii');
  assertEqual(updated.derived.eventCount, 1, 'edits must not corrupt derived caches');

  await assertThrows(() => updatePlant(plant.id, { name: '' }), ValidationError);
  await assertThrows(() => updatePlant('nope', { name: 'X' }), NotFoundError);
});

test('should refresh derived care fields on log, without regressing on backdates', async () => {
  const plant = await createPlant({ name: 'Bougainvillea Red' });

  await logEvent(plant.id, 'watering', { occurredAt: '2026-07-08T06:00:00.000Z' });
  let current = await getPlant(plant.id);
  assertEqual(current.derived.lastWateredAt, '2026-07-08T06:00:00.000Z');
  assertEqual(current.derived.eventCount, 1);

  // Backdated log: history grows, but "last watered" must not move backward.
  await logEvent(plant.id, 'watering', { occurredAt: '2026-07-01T06:00:00.000Z' });
  current = await getPlant(plant.id);
  assertEqual(current.derived.lastWateredAt, '2026-07-08T06:00:00.000Z');
  assertEqual(current.derived.eventCount, 2);

  await assertThrows(
    () => logEvent(plant.id, 'watering', { occurredAt: '2099-01-01T00:00:00.000Z' }),
    ValidationError,
  );
  await assertThrows(() => logEvent(plant.id, 'levitating'), ValidationError);
  await assertThrows(() => logEvent('no-such-plant', 'watering'), NotFoundError);
});

test('should bulk-log with one batch id and undo restores derived caches', async () => {
  const a = await createPlant({ name: 'Snake Plant A' });
  const b = await createPlant({ name: 'Snake Plant B' });
  await logEvent(a.id, 'watering', { occurredAt: '2026-07-05T06:00:00.000Z' });

  const { events, batchId } = await logBulk([a.id, b.id], 'watering', {
    occurredAt: '2026-07-09T06:00:00.000Z',
  });
  assertEqual(events.length, 2);
  assert(events.every((e) => e.batchId === batchId), 'bulk events must share one batchId');

  assertEqual((await getPlant(a.id)).derived.lastWateredAt, '2026-07-09T06:00:00.000Z');
  assertEqual((await getPlant(b.id)).derived.lastWateredAt, '2026-07-09T06:00:00.000Z');

  const { undone } = await undoBatch(batchId);
  assertEqual(undone, 2);
  const aAfter = await getPlant(a.id);
  assertEqual(aAfter.derived.lastWateredAt, '2026-07-05T06:00:00.000Z', 'undo must recompute from surviving events');
  assertEqual(aAfter.derived.eventCount, 1);
  const bAfter = await getPlant(b.id);
  assertEqual(bAfter.derived.lastWateredAt, null);
  assertEqual(bAfter.derived.eventCount, 0);
});

test('should serve the timeline newest-first with pagination and type filter', async () => {
  const plant = await createPlant({ name: 'Rose Timeline' });
  const days = ['01', '02', '03', '04', '05'];
  for (const day of days) {
    await logEvent(plant.id, day === '03' ? 'fertilizing' : 'watering', {
      occurredAt: `2026-06-${day}T06:00:00.000Z`,
    });
  }

  const page1 = await getTimeline(plant.id, { limit: 2 });
  assertEqual(page1.items.map((e) => e.occurredAt.slice(8, 10)), ['05', '04']);
  const page2 = await getTimeline(plant.id, { limit: 2, cursor: page1.nextCursor });
  assertEqual(page2.items.map((e) => e.occurredAt.slice(8, 10)), ['03', '02']);

  const fertilizing = await getTimeline(plant.id, { types: ['fertilizing'], limit: 10 });
  assertEqual(fertilizing.items.length, 1);
  assertEqual(fertilizing.items[0].occurredAt.slice(8, 10), '03');
});

test('should filter, search, and sort the plant list', async () => {
  await clearPlantStores();
  await createPlant({ name: 'Tulsi', category: 'herb' });
  await createPlant({ name: 'Mint', category: 'herb' });
  const rose = await createPlant({ name: 'Desi Rose', category: 'flower', botanicalName: 'Rosa indica' });
  await setPlantStatus(rose.id, 'archived');

  const active = await listPlants();
  assertEqual(active.map((p) => p.name), ['Mint', 'Tulsi'], 'default: active only, sorted by name');

  const archived = await listPlants({ status: 'archived' });
  assertEqual(archived.map((p) => p.name), ['Desi Rose']);

  const herbs = await listPlants({ category: 'herb', sort: 'newest' });
  assertEqual(herbs.map((p) => p.name), ['Mint', 'Tulsi'], 'newest-first sort');

  const search = await listPlants({ status: 'archived', search: 'rosa ind' });
  assertEqual(search.length, 1, 'search must cover botanical names');
});

test('should cascade events when a plant is deleted permanently', async () => {
  const plant = await createPlant({ name: 'Doomed Okra', category: 'vegetable' });
  await logBulk([plant.id], 'watering', {});
  await logEvent(plant.id, 'observation');

  const events = new Repository(STORES.events);
  const before = await events.count({ index: 'plantId', range: IDBKeyRange.only(plant.id) });
  assertEqual(before, 2);

  const { deletedEvents } = await deletePlantPermanently(plant.id);
  assertEqual(deletedEvents, 2);
  assertEqual(await getPlant(plant.id), null);
  assertEqual(await events.count({ index: 'plantId', range: IDBKeyRange.only(plant.id) }), 0);
});
