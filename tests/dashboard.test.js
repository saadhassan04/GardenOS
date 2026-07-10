/**
 * Dashboard integration tests — v1.4: widget registry + layout
 * persistence, garden stats, daily event series, needs-attention logic.
 */

import { test, assert, assertEqual, assertThrows } from './testKit.js';
import { STORES } from '../database/stores.js';
import { Repository } from '../database/Repository.js';
import { createPlant, updatePlant } from '../services/plantService.js';
import { logEvent } from '../services/careEventService.js';
import { createNote } from '../services/notesService.js';
import { createBatch } from '../services/kitchenGardenService.js';
import { gardenStats, dailyEventCounts } from '../services/analyticsService.js';
import { listNeedsWatering } from '../services/careProfileService.js';
import { setSetting } from '../storage/settings.js';
import {
  registerWidget,
  getActiveWidgets,
  getWidgetSettings,
  saveLayout,
  _resetRegistryForTests,
} from '../widgets/registry.js';
import { ValidationError } from '../utils/errors.js';

const DAY_MS = 86_400_000;

function localKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgoNoon(days) {
  const d = new Date(Date.now() - days * DAY_MS);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

test('should order, toggle, and persist dashboard widgets via the registry', async () => {
  _resetRegistryForTests();
  const render = () => {};
  registerWidget({ id: 'alpha', title: 'Alpha', defaultOrder: 2, render });
  registerWidget({ id: 'beta', title: 'Beta', defaultOrder: 1, render });
  registerWidget({ id: 'gamma', title: 'Gamma', defaultOrder: 3, render });
  await assertThrows(() => registerWidget({ id: 'alpha', title: 'Dup', defaultOrder: 9, render }), ValidationError);
  await assertThrows(() => registerWidget({ id: 'broken', title: 'No render', defaultOrder: 1 }), ValidationError);

  setSetting('dashboardLayout', null);
  assertEqual(getActiveWidgets().map((w) => w.id), ['beta', 'alpha', 'gamma'], 'default order must apply');

  saveLayout({ order: ['gamma', 'alpha', 'beta'], disabled: ['alpha', 'ghost-widget'] });
  assertEqual(getActiveWidgets().map((w) => w.id), ['gamma', 'beta'], 'user order + disabled must apply');
  const settings = getWidgetSettings();
  assertEqual(settings.map((s) => s.spec.id), ['gamma', 'alpha', 'beta']);
  assertEqual(settings.find((s) => s.spec.id === 'alpha').enabled, false);

  setSetting('dashboardLayout', null); // leave no residue for the app
});

test('should report garden stats from a known state', async () => {
  for (const name of [STORES.plants, STORES.events, STORES.notes, STORES.sowingBatches, STORES.harvests, STORES.images, STORES.thumbnails]) {
    await new Repository(name).clearAll();
  }
  await createPlant({ name: 'Stats Plant A' });
  const b = await createPlant({ name: 'Stats Plant B' });
  await logEvent(b.id, 'watering');
  await createNote({ title: 'Stats note' });
  await createBatch({ crop: 'Radish' });

  const stats = await gardenStats();
  assertEqual(stats.plantsActive, 2);
  assertEqual(stats.eventsLogged, 1);
  assertEqual(stats.notes, 1);
  assertEqual(stats.activeBatches, 1);
  assertEqual(stats.photos, 0);
});

test('should zero-fill and bucket daily event counts by local day', async () => {
  await new Repository(STORES.events).clearAll();
  const plant = await createPlant({ name: 'Series Plant' });
  await logEvent(plant.id, 'watering', { occurredAt: daysAgoNoon(1) });
  await logEvent(plant.id, 'watering', { occurredAt: daysAgoNoon(1) });
  await logEvent(plant.id, 'watering', { occurredAt: daysAgoNoon(3) });
  await logEvent(plant.id, 'fertilizing', { occurredAt: daysAgoNoon(1) });

  const series = await dailyEventCounts({ type: 'watering', days: 5 });
  assertEqual(series.length, 5, 'every day in the window must be present');
  const byDate = Object.fromEntries(series.map((d) => [d.date, d.count]));
  assertEqual(byDate[localKey(new Date(Date.now() - 1 * DAY_MS))], 2);
  assertEqual(byDate[localKey(new Date(Date.now() - 3 * DAY_MS))], 1);
  assertEqual(byDate[localKey(new Date())], 0, 'days without events must be zero, not missing');
  assertEqual(series.at(-1).date, localKey(new Date()), 'series must end today');
});

test('should list watering-due plants most-overdue first', async () => {
  const overdue = await createPlant({ name: 'Overdue Rose' });
  await updatePlant(overdue.id, { careOverrides: { wateringEveryDays: 2 } });
  await logEvent(overdue.id, 'watering', { occurredAt: daysAgoNoon(5) });

  const fresh = await createPlant({ name: 'Fresh Mint' });
  await updatePlant(fresh.id, { careOverrides: { wateringEveryDays: 10 } });
  await logEvent(fresh.id, 'watering');

  const neverWatered = await createPlant({ name: 'Never Watered Palm' });
  await updatePlant(neverWatered.id, { careOverrides: { wateringEveryDays: 3 } });

  const due = await listNeedsWatering();
  const ids = due.map((entry) => entry.plant.id);
  assert(ids.includes(overdue.id), 'overdue plant must appear');
  assert(!ids.includes(fresh.id), 'freshly watered plant must not appear');
  assert(ids.includes(neverWatered.id), 'never-watered plant must appear');
  assert(
    ids.indexOf(neverWatered.id) < ids.indexOf(overdue.id),
    'never-watered sorts as most urgent',
  );
  const overdueEntry = due.find((entry) => entry.plant.id === overdue.id);
  assertEqual(overdueEntry.daysSince, 5);
  assertEqual(overdueEntry.everyDays, 2);
});
