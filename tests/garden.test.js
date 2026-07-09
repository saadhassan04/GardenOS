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
} from '../services/careProfileService.js';
import { KARACHI_CARE_PROFILES } from '../database/seed/careProfiles.karachi.js';
import { observePest, resolvePest, listActivePestsForPlant } from '../services/pestService.js';
import {
  applyTreatment,
  recordOutcome,
  whatWorkedFor,
} from '../services/treatmentService.js';
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
