/**
 * Garden setup integration tests — locations, care profiles (seeding +
 * effective care resolution), pests & treatments (v1.1 increment 3).
 */

import { test, assert, assertEqual, assertThrows } from './testKit.js';
import { STORES } from '../database/stores.js';
import { Repository } from '../database/Repository.js';
import { createPlant, getPlant, updatePlant } from '../services/plantService.js';
import { logEvent } from '../services/careEventService.js';
import { getTimeline } from '../services/careEventService.js';
import {
  createLocation,
  deleteLocation,
  listLocations,
  countPlantsAt,
} from '../services/locationsService.js';
import {
  ensureSeededCareProfiles,
  listCareProfiles,
  effectiveWateringDays,
  wateringSchedule,
  resolveWateringSchedules,
  listNeedsWatering,
  createCareProfile,
  updateCareProfile,
  deleteCareProfile,
  countPlantsUsingProfile,
} from '../services/careProfileService.js';
import { KARACHI_CARE_PROFILES } from '../database/seed/careProfiles.karachi.js';
import { observePest, resolvePest, listActivePestsForPlant } from '../services/pestService.js';
import {
  applyTreatment,
  recordOutcome,
  whatWorkedFor,
} from '../services/treatmentService.js';
import {
  ensureSeededGarden,
  ensureGardenRecategorized,
  ensurePhotoAuditCorrected,
  _clearSeedFlagForTests,
} from '../services/gardenSeedService.js';
import { KARACHI_STARTER_GARDEN } from '../database/seed/ownerGarden.karachi.js';
import { ValidationError } from '../utils/errors.js';

test('should manage locations and refuse deleting one with residents', async () => {
  await new Repository(STORES.locations).clearAll();

  const balcony = await createLocation({ name: 'East Balcony', kind: 'balcony', sunProfile: 'full-am' });
  await assertThrows(() => createLocation({ name: '' }), ValidationError);
  await assertThrows(() => createLocation({ name: 'X', kind: 'space-station' }), ValidationError);

  const plant = await createPlant({ name: 'Balcony Fern', locationId: balcony.id });
  assertEqual(await countPlantsAt(balcony.id), 1);

  await assertThrows(() => deleteLocation(balcony.id), ValidationError);

  await updatePlant(plant.id, { locationId: null });
  await deleteLocation(balcony.id);
  assertEqual((await listLocations()).length, 0);
});

test('should seed Karachi care profiles exactly once', async () => {
  await new Repository(STORES.careProfiles).clearAll();

  const first = await ensureSeededCareProfiles();
  assertEqual(first.seeded, KARACHI_CARE_PROFILES.length);

  const second = await ensureSeededCareProfiles();
  assertEqual(second.seeded, 0, 'second run must not duplicate profiles');
  assertEqual((await listCareProfiles()).length, KARACHI_CARE_PROFILES.length);
});

test('should resolve effective watering: override → seasonal → base', async () => {
  const profiles = await listCareProfiles();
  const plumeria = profiles.find((p) => p.name.startsWith('Plumeria'));
  assert(plumeria, 'seeded plumeria profile missing');

  const plant = await createPlant({ name: 'Effective Test Plumeria', careProfileId: plumeria.id });

  const july = new Date('2026-07-15T12:00:00'); // monsoon
  const january = new Date('2026-01-15T12:00:00'); // winter
  assertEqual(effectiveWateringDays(plant, plumeria, july), 7, 'monsoon seasonal value expected');
  assertEqual(effectiveWateringDays(plant, plumeria, january), 10, 'winter seasonal value expected');

  const overridden = await updatePlant(plant.id, { careOverrides: { wateringEveryDays: 2 } });
  assertEqual(effectiveWateringDays(overridden, plumeria, july), 2, 'plant override must win');

  assertEqual(effectiveWateringDays(plant, null), null, 'no profile, no override → unknown');
});

test('should compute the watering schedule the plant list renders', async () => {
  const now = new Date('2026-07-15T12:00:00');
  const profile = { wateringEveryDays: 10 };
  const at = (iso) => ({ derived: { lastWateredAt: iso }, careOverrides: {} });

  // Watered 6 days ago on a 10-day interval → 4 days left, 60% of the cycle.
  const mid = wateringSchedule(at('2026-07-09T12:00:00'), profile, now);
  assertEqual(mid.daysUntil, 4, 'four days until the next watering');
  assertEqual(mid.everyDays, 10);
  assertEqual(Math.round(mid.elapsedRatio * 100), 60, 'progress is the spent fraction of the cycle');
  assertEqual(mid.neverWatered, false);

  // Due exactly today.
  assertEqual(wateringSchedule(at('2026-07-05T12:00:00'), profile, now).daysUntil, 0, 'due today');

  // Overdue: negative days, and the bar is capped rather than overflowing.
  const late = wateringSchedule(at('2026-07-01T12:00:00'), profile, now);
  assertEqual(late.daysUntil, -4, 'four days overdue');
  assertEqual(late.elapsedRatio, 1, 'elapsed ratio must clamp at 1');

  // Never watered → due now, nothing to count from.
  const fresh = wateringSchedule({ derived: { lastWateredAt: null }, careOverrides: {} }, profile, now);
  assertEqual(fresh.neverWatered, true);
  assertEqual(fresh.daysUntil, 0);

  // No profile and no override → no schedule. Never a guessed date.
  assertEqual(wateringSchedule(at('2026-07-09T12:00:00'), null, now), null, 'unknown interval → null');

  // A plant override wins, and rounding is "within N days" (up, not down).
  const overridden = { derived: { lastWateredAt: '2026-07-14T00:00:00' }, careOverrides: { wateringEveryDays: 3 } };
  assertEqual(wateringSchedule(overridden, profile, now).daysUntil, 2, 'partial days round up');
});

test('should agree with the dashboard on which plants are due', async () => {
  const plants = new Repository(STORES.plants);
  await plants.clearAll();
  const profiles = await listCareProfiles();
  const plumeria = profiles.find((p) => p.name.startsWith('Plumeria'));

  const due = await createPlant({ name: 'Thirsty One', careProfileId: plumeria.id });
  const watered = await createPlant({ name: 'Fine One', careProfileId: plumeria.id });
  const unknown = await createPlant({ name: 'No Profile One' });
  // Plumeria in monsoon is every 7 days: 30 days ago is due, today is not.
  await logEvent(due.id, 'watering', { occurredAt: '2026-06-15T06:00:00.000Z' });
  await logEvent(watered.id, 'watering');
  await logEvent(unknown.id, 'watering', { occurredAt: '2026-06-15T06:00:00.000Z' });

  const loaded = await Promise.all([getPlant(due.id), getPlant(watered.id), getPlant(unknown.id)]);
  const schedules = await resolveWateringSchedules(loaded);

  assert(schedules.get(due.id).daysUntil <= 0, 'long-unwatered plant must read as due');
  assert(schedules.get(watered.id).daysUntil > 0, 'just-watered plant must not read as due');
  assertEqual(schedules.get(unknown.id), null, 'no profile → no schedule, so never "due"');

  // The Plants list and the dashboard widget must never disagree.
  const needsWatering = new Set((await listNeedsWatering()).map(({ plant }) => plant.id));
  for (const plant of loaded) {
    const schedule = schedules.get(plant.id);
    assertEqual(
      Boolean(schedule) && schedule.daysUntil <= 0,
      needsWatering.has(plant.id),
      `due state for ${plant.name} must match listNeedsWatering`,
    );
  }
});

test('should create, edit, and guard-delete user care profiles', async () => {
  const created = await createCareProfile({
    name: 'My Test Roses',
    species: 'Rosa',
    wateringSeasonal: { summer: 1, monsoon: 3, winter: 2 },
    fertilizeEveryDays: 15,
  });
  assertEqual(created.source, 'user', 'user-created profiles must be tagged user');
  assertEqual(created.wateringSeasonal.summer, 1);

  const edited = await updateCareProfile(created.id, { fertilizeEveryDays: 21 });
  assertEqual(edited.fertilizeEveryDays, 21);
  assertEqual(edited.source, 'user', 'editing must preserve source');

  // Editing a seeded preset keeps its 'seed' source (auditability).
  const seeded = (await listCareProfiles()).find((p) => p.source === 'seed');
  const editedSeed = await updateCareProfile(seeded.id, { pruningNotes: 'tweaked' });
  assertEqual(editedSeed.source, 'seed', 'editing a preset must not relabel it');

  // Delete guard: a profile in use cannot be deleted.
  const plant = await createPlant({ name: 'Profile User Plant', careProfileId: created.id });
  assertEqual(await countPlantsUsingProfile(created.id), 1);
  await assertThrows(() => deleteCareProfile(created.id), ValidationError);

  await updatePlant(plant.id, { careProfileId: null });
  await deleteCareProfile(created.id);
  assert(!(await listCareProfiles()).some((p) => p.id === created.id), 'unused profile must delete');
});

test('should round-trip a per-plant watering override', async () => {
  const profiles = await listCareProfiles();
  const anyProfile = profiles[0];
  const plant = await createPlant({ name: 'Override Round Trip', careProfileId: anyProfile.id });

  const withOverride = await updatePlant(plant.id, { careOverrides: { wateringEveryDays: 4 } });
  assertEqual(withOverride.careOverrides.wateringEveryDays, 4);
  assertEqual(effectiveWateringDays(withOverride, anyProfile), 4, 'override must beat the profile');

  // Clearing the override falls back to the profile.
  const cleared = await updatePlant(plant.id, { careOverrides: null });
  assertEqual(cleared.careOverrides, null);
  assert(effectiveWateringDays(cleared, anyProfile) !== 4, 'cleared override must fall back to profile');
});

test('should seed the owner starter garden once, on fresh installs only', async () => {
  const plants = new Repository(STORES.plants);
  await plants.clearAll();
  await _clearSeedFlagForTests();

  const first = await ensureSeededGarden();
  assertEqual(first.seeded, KARACHI_STARTER_GARDEN.length);
  assertEqual(await plants.count(), KARACHI_STARTER_GARDEN.length);

  const { items } = await plants.query({ index: 'name', range: IDBKeyRange.only('Black Plumeria'), limit: 1 });
  const blackPlumeria = items[0];
  assert(blackPlumeria, 'the flagship plumeria must be planted');
  assert(blackPlumeria.careProfileId, 'seeded plants must link their Karachi care profile');
  assertEqual(blackPlumeria.botanicalName, 'Plumeria rubra');

  const second = await ensureSeededGarden();
  assertEqual(second.seeded, 0, 'seeding must be idempotent');

  // A deliberately emptied garden stays empty: the flag outlives the data.
  await plants.clearAll();
  const third = await ensureSeededGarden();
  assertEqual(third.seeded, 0, 'an emptied garden must never re-seed');

  // A pre-existing garden without the flag (restored backup) is untouched.
  await _clearSeedFlagForTests();
  await createPlant({ name: 'Pre-existing Plant' });
  const fourth = await ensureSeededGarden();
  assertEqual(fourth.seeded, 0, 'an existing garden must never be seeded over');
  assertEqual(await plants.count(), 1);
});

test('should recategorize old-taxonomy seeded plants once, sparing user edits', async () => {
  const plants = new Repository(STORES.plants);
  await plants.clearAll();
  await _clearSeedFlagForTests();

  // Simulate a garden seeded under the OLD taxonomy.
  const snake = await createPlant({ name: 'Snake Plant', category: 'indoor' });
  const rose = await createPlant({ name: 'Rose', category: 'flower' });
  // A plant the user already recategorized themselves — must be left alone.
  const userMoved = await createPlant({ name: 'Bougainvillea', category: 'shrub' });
  // A same-name plant that is not at the "from" value — untouched.
  const lemon = await createPlant({ name: 'Lemon', category: 'tree' });

  const { updated } = await ensureGardenRecategorized();
  assert(updated >= 2, 'old-taxonomy plants must be corrected');

  assertEqual((await plants.get(snake.id)).category, 'succulent', 'snake plant → succulent');
  assertEqual((await plants.get(rose.id)).category, 'shrub', 'rose → shrub');
  assertEqual((await plants.get(userMoved.id)).category, 'shrub', 'user-set category must be preserved (not forced to climber)');
  assertEqual((await plants.get(lemon.id)).category, 'tree', 'non-matching category untouched');

  // Idempotent: a second run changes nothing.
  const again = await ensureGardenRecategorized();
  assertEqual(again.updated, 0, 'recategorization must run only once');
});

test('should apply photo-audit corrections once, sparing user edits', async () => {
  const plants = new Repository(STORES.plants);
  await plants.clearAll();
  await _clearSeedFlagForTests();

  // Renamed plants the name-keyed recategorization could never match.
  const bougain = await createPlant({ name: 'Bougainvillea 1 White', category: 'flower' });
  const snake = await createPlant({ name: 'Snake Plant 2', category: 'indoor' });
  const coleus = await createPlant({ name: 'Coleus', category: 'outdoor' });
  // Rose Pink gets both corrections: category → shrub and a botanical name.
  const rosePink = await createPlant({ name: 'Rose Pink', category: 'flower' });
  // A plant the owner already recategorized themselves — must be left alone.
  const userMoved = await createPlant({ name: 'Umbrella Plant', category: 'bonsai' });
  // An owner-entered botanical must never be overwritten by the audit value.
  const roseRed = await createPlant({
    name: 'Rose Red 1',
    category: 'flower',
    botanicalName: 'Rosa chinensis',
  });

  const { updated } = await ensurePhotoAuditCorrected();
  assert(updated >= 5, 'audited plants must be corrected');

  assertEqual((await plants.get(bougain.id)).category, 'climber', 'bougainvillea → climber');
  assertEqual((await plants.get(snake.id)).category, 'succulent', 'snake plant → succulent');
  assertEqual((await plants.get(coleus.id)).category, 'foliage', 'coleus → foliage');
  assertEqual((await plants.get(rosePink.id)).category, 'shrub', 'rose pink → shrub');
  assertEqual(
    (await plants.get(rosePink.id)).botanicalName,
    'Rosa indica',
    'rose pink must gain its botanical name',
  );
  assertEqual(
    (await plants.get(userMoved.id)).category,
    'bonsai',
    'owner-set category must be preserved (not forced to foliage)',
  );
  assertEqual(
    (await plants.get(roseRed.id)).botanicalName,
    'Rosa chinensis',
    'owner-entered botanical must be preserved',
  );

  // Idempotent: a second run changes nothing.
  const again = await ensurePhotoAuditCorrected();
  assertEqual(again.updated, 0, 'photo-audit corrections must run only once');
});

test('should run the pest lifecycle and stamp plant timelines', async () => {
  const plant = await createPlant({ name: 'Pest Test Rose' });

  const record = await observePest({
    pestType: '  Mealybug ',
    plantIds: [plant.id],
    severity: 'high',
    notes: 'white fluff on stems',
  });
  assertEqual(record.pestType, 'mealybug', 'pest type must normalize');

  const active = await listActivePestsForPlant(plant.id);
  assertEqual(active.length, 1);

  const timeline = await getTimeline(plant.id, { types: ['pest-observation'], limit: 5 });
  assertEqual(timeline.items.length, 1, 'observation must appear on the timeline');
  assertEqual(timeline.items[0].data.pestType, 'mealybug');

  await resolvePest(record.id);
  assertEqual((await listActivePestsForPlant(plant.id)).length, 0);
  const resolved = await new Repository(STORES.pestRecords).get(record.id);
  assert(resolved.resolvedAt, 'resolvedAt must be stamped');

  await assertThrows(() => observePest({ pestType: 'aphid', plantIds: [] }), ValidationError);
});

test('should answer "what worked for X" from recorded outcomes', async () => {
  const plant = await createPlant({ name: 'Treatment Test Chili' });

  const outbreak1 = await observePest({ pestType: 'aphid', plantIds: [plant.id] });
  const neem = await applyTreatment({
    pestRecordId: outbreak1.id,
    plantIds: [plant.id],
    product: 'Neem oil',
    type: 'organic',
    dose: '5 ml/L',
  });
  const soap = await applyTreatment({
    pestRecordId: outbreak1.id,
    plantIds: [plant.id],
    product: 'Soap spray',
    type: 'organic',
  });
  await recordOutcome(neem.id, 'effective');
  await recordOutcome(soap.id, 'ineffective');
  await resolvePest(outbreak1.id);

  const worked = await whatWorkedFor('APHID');
  assertEqual(worked.length, 1, 'only effective/partial outcomes qualify');
  assertEqual(worked[0].product, 'Neem oil');

  const treatmentEvents = await getTimeline(plant.id, { types: ['treatment'], limit: 5 });
  assertEqual(treatmentEvents.items.length, 2, 'treatments must stamp the timeline');

  await assertThrows(() => recordOutcome(neem.id, 'miraculous'), ValidationError);
  await assertThrows(
    () => applyTreatment({ plantIds: [plant.id], product: '' }),
    ValidationError,
  );
});
