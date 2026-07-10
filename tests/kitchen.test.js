/**
 * Kitchen garden integration tests — v1.3: sowing lifecycle, harvests,
 * yield totals, growing seasons, and the Karachi sowing calendar.
 */

import { test, assert, assertEqual, assertThrows } from './testKit.js';
import { STORES } from '../database/stores.js';
import { Repository } from '../database/Repository.js';
import { createPlant } from '../services/plantService.js';
import { getTimeline } from '../services/careEventService.js';
import {
  createBatch,
  getBatch,
  advanceStage,
  listBatches,
  logHarvest,
  getYield,
  currentGrowingSeason,
} from '../services/kitchenGardenService.js';
import {
  getSowingSuggestions,
  saveCustomCrop,
  removeCustomCrop,
  listAllCropNames,
} from '../services/sowingCalendarService.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

async function clearKitchenStores() {
  await new Repository(STORES.sowingBatches).clearAll();
  await new Repository(STORES.harvests).clearAll();
}

test('should create sowing batches with validated defaults and history', async () => {
  await clearKitchenStores();

  await assertThrows(() => createBatch({}), ValidationError);
  await assertThrows(() => createBatch({ crop: 'Tomato', quantity: -5 }), ValidationError);
  await assertThrows(
    () => createBatch({ crop: 'Tomato', sownAt: '2099-01-01T00:00:00.000Z' }),
    ValidationError,
  );

  const batch = await createBatch({ crop: '  Tomato ', variety: 'Roma', quantity: 24, sownAt: '2026-07-01T12:00:00.000Z' });
  assertEqual(batch.crop, 'Tomato');
  assertEqual(batch.stage, 'sown');
  assertEqual(batch.stageHistory.length, 1);
  assertEqual(batch.stageHistory[0], { stage: 'sown', at: '2026-07-01T12:00:00.000Z' });
});

test('should advance stages forward-only and append history', async () => {
  const batch = await createBatch({ crop: 'Okra', sownAt: '2026-07-01T12:00:00.000Z' });

  // Direct-sown okra skips transplanting entirely — allowed.
  const advanced = await advanceStage(batch.id, 'flowering', { at: '2026-07-05T12:00:00.000Z' });
  assertEqual(advanced.stage, 'flowering');
  assertEqual(advanced.stageHistory.map((h) => h.stage), ['sown', 'flowering']);

  await assertThrows(() => advanceStage(batch.id, 'germinated'), ValidationError, 'backwards move must fail');
  await assertThrows(() => advanceStage(batch.id, 'flowering'), ValidationError, 'same stage must fail');
  await assertThrows(() => advanceStage(batch.id, 'levitating'), ValidationError);
  await assertThrows(() => advanceStage('no-such-batch', 'finished'), NotFoundError);

  await advanceStage(batch.id, 'finished');
  const active = await listBatches();
  assert(!active.some((b) => b.id === batch.id), 'finished batches must leave the active list');
  const all = await listBatches({ includeFinished: true });
  assert(all.some((b) => b.id === batch.id), 'finished batches must remain reachable');
});

test('should log harvests that inherit crop and pull the batch to harvesting', async () => {
  await clearKitchenStores();
  const batch = await createBatch({ crop: 'Cucumber', sownAt: '2026-06-01T12:00:00.000Z' });
  await advanceStage(batch.id, 'fruiting', { at: '2026-06-20T12:00:00.000Z' });

  const harvest = await logHarvest({
    sowingBatchId: batch.id,
    quantity: 1.5,
    unit: 'kg',
    harvestedAt: '2026-07-01T12:00:00.000Z',
  });
  assertEqual(harvest.crop, 'Cucumber', 'crop must inherit from the batch');

  const after = await getBatch(batch.id);
  assertEqual(after.stage, 'harvesting', 'first harvest must advance a fruiting batch');
  assertEqual(after.stageHistory.at(-1).at, harvest.harvestedAt);

  await assertThrows(() => logHarvest({ crop: 'X', quantity: 0, unit: 'kg' }), ValidationError);
  await assertThrows(() => logHarvest({ crop: 'X', quantity: 1, unit: 'sacks' }), ValidationError);
  await assertThrows(
    () => logHarvest({ sowingBatchId: 'no-such-batch', quantity: 1, unit: 'kg' }),
    NotFoundError,
  );
});

test('should stamp plant timelines for plant-linked batches and harvests', async () => {
  const plant = await createPlant({ name: 'Kitchen Lemon Tree' });
  const batch = await createBatch({ crop: 'Lemon', plantId: plant.id, sownAt: '2026-06-01T12:00:00.000Z' });

  await advanceStage(batch.id, 'fruiting', { at: '2026-06-15T12:00:00.000Z' });
  await logHarvest({ plantId: plant.id, crop: 'Lemon', quantity: 12, unit: 'count', harvestedAt: '2026-07-01T12:00:00.000Z' });

  const stageEvents = await getTimeline(plant.id, { types: ['stage-change'], limit: 5 });
  assertEqual(stageEvents.items.length, 1, 'stage change must stamp the plant timeline');
  assertEqual(stageEvents.items[0].data.to, 'fruiting');

  const harvestEvents = await getTimeline(plant.id, { types: ['harvest'], limit: 5 });
  assertEqual(harvestEvents.items.length, 1, 'harvest must stamp the plant timeline');
  assertEqual(harvestEvents.items[0].data.quantity, 12);
});

test('should total yields per crop and unit within a season window', async () => {
  await clearKitchenStores();
  await logHarvest({ crop: 'Tomato', quantity: 2, unit: 'kg', harvestedAt: '2026-01-10T12:00:00.000Z' });
  await logHarvest({ crop: 'Tomato', quantity: 1.5, unit: 'kg', harvestedAt: '2026-01-20T12:00:00.000Z' });
  await logHarvest({ crop: 'Tomato', quantity: 8, unit: 'count', harvestedAt: '2026-02-01T12:00:00.000Z' });
  await logHarvest({ crop: 'Okra', quantity: 500, unit: 'g', harvestedAt: '2026-06-15T12:00:00.000Z' });

  const winter = currentGrowingSeason(new Date('2026-01-15T12:00:00'));
  assertEqual(winter.label, 'Winter 2025–26');
  const winterYield = await getYield({ from: winter.from, to: winter.to });
  assertEqual(winterYield.byCrop.Tomato.kg, 3.5);
  assertEqual(winterYield.byCrop.Tomato.count, 8);
  assertEqual(winterYield.byCrop.Okra, undefined, 'summer okra must not leak into winter totals');

  const tomatoOnly = await getYield({ crop: 'Tomato' });
  assertEqual(tomatoOnly.entries, 3);

  const summer = currentGrowingSeason(new Date('2026-06-15T12:00:00'));
  assertEqual(summer.label, 'Summer 2026');
  const octSeason = currentGrowingSeason(new Date('2026-11-01T12:00:00'));
  assertEqual(octSeason.label, 'Winter 2026–27');
});

test('should suggest Karachi sowings by month and honor custom crops', async () => {
  const october = await getSowingSuggestions(10);
  const octoberCrops = october.map((e) => e.crop);
  assert(octoberCrops.includes('Tomato'), 'October must suggest tomato');
  assert(octoberCrops.includes('Peas'), 'October must suggest peas');
  assert(!octoberCrops.includes('Okra'), 'okra is not an October sowing');

  await assertThrows(() => saveCustomCrop({ crop: 'Kale', months: [] }), ValidationError);
  await saveCustomCrop({ crop: 'Kale', months: [10, 11, 13, 10] });

  const withCustom = await getSowingSuggestions(10);
  const kale = withCustom.find((e) => e.crop === 'Kale');
  assert(kale && kale.custom, 'custom crop must appear in its months');
  assertEqual(kale.months, [10, 11], 'months must dedupe and drop invalid values');
  assert((await listAllCropNames()).includes('Kale'));

  await removeCustomCrop('kale');
  assert(!(await getSowingSuggestions(10)).some((e) => e.crop === 'Kale'), 'removed custom crop must disappear');
});
