/**
 * Garden setup integration tests — locations, care profiles (seeding +
 * effective care resolution), pests & treatments (v1.1 increment 3).
 */

import { test, assert, assertEqual, assertThrows } from './testKit.js';
import { STORES } from '../database/stores.js';
import { Repository } from '../database/Repository.js';
import { createPlant, getPlant, updatePlant } from '../services/plantService.js';
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
