/**
 * Today service (Business layer, L3) — PHASE2_HANDOFF §5.1.
 * A read model over existing stores: what needs the gardener today.
 * `buildToday` is pure (one test); `getToday` just loads its inputs.
 */

import { plantRepository } from '../database/PlantRepository.js';
import { listCareProfiles, wateringSchedule, fertilizeSchedule } from './careProfileService.js';
import { listLocations } from './locationsService.js';
import { listActivePests } from './pestService.js';
import { listTreatmentsForPest } from './treatmentService.js';
import { getInbox } from './taskSchedulerService.js';
import { lastFeeding } from './fertilizerService.js';

/**
 * @param {{plants: object[], profiles: object[], locations: object[],
 *   tasks: object[], pests: object[]}} input pests carry `lastTreatment`
 * @param {Date} now
 */
export function buildToday({ plants, profiles, locations, tasks, pests }, now) {
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const groupMap = new Map();
  const noHistory = [];
  const feed = [];
  const tomorrow = { water: 0, feed: 0 };

  for (const plant of plants) {
    const profile = plant.careProfileId ? profileById.get(plant.careProfileId) ?? null : null;

    const water = wateringSchedule(plant, profile, now);
    if (water) {
      const last = plant.derived?.lastWateredAt;
      if (water.neverWatered) {
        noHistory.push(plant); // D2: unknown history is not an alarm
      } else {
        if (water.daysUntil === 1) {
          tomorrow.water += 1;
        }
        const done = Date.parse(last) >= startOfToday.getTime();
        if (done || water.daysUntil <= 0) {
          const key = plant.locationId ?? '';
          if (!groupMap.has(key)) {
            groupMap.set(key, { location: locationName.get(key) ?? 'No location', items: [] });
          }
          groupMap.get(key).items.push({ plant, done, wateredAt: done ? last : null, overdueDays: Math.max(0, -water.daysUntil) });
        }
      }
    }

    // ponytail: never-fed plants are skipped (same false-alarm reasoning as D2); show them once a first feed is logged.
    const fertilize = fertilizeSchedule(plant, profile, now);
    if (fertilize && !fertilize.neverDone) {
      if (fertilize.daysUntil === 1) {
        tomorrow.feed += 1;
      }
      if (fertilize.daysUntil <= 0) {
        feed.push({ plant, everyDays: fertilize.everyDays, overdueDays: -fertilize.daysUntil, lastAt: plant.derived.lastFertilizedAt });
      }
    }
  }

  const groups = [...groupMap.values()];
  for (const group of groups) {
    group.items.sort((a, b) => a.done - b.done || b.overdueDays - a.overdueDays || a.plant.name.localeCompare(b.plant.name));
    group.dueCount = group.items.filter((item) => !item.done).length;
  }
  groups.sort((a, b) => b.dueCount - a.dueCount || a.location.localeCompare(b.location));
  feed.sort((a, b) => b.overdueDays - a.overdueDays);

  const plantName = new Map(plants.map((p) => [p.id, p.name]));
  const problems = pests
    .map((pest) => ({
      pest,
      names: pest.plantIds.map((id) => plantName.get(id)).filter(Boolean),
      treatedAt: pest.lastTreatment?.appliedAt ?? null,
      outcomePending: !!pest.lastTreatment && !pest.lastTreatment.outcome,
    }))
    .filter((entry) => entry.names.length > 0)
    .sort((a, b) => (a.treatedAt ?? '').localeCompare(b.treatedAt ?? '')); // untreated ('') first, then oldest

  const dueTasks = tasks.filter((task) => task.taskType !== 'watering'); // watering is the live schedule

  const waterDue = groups.reduce((n, g) => n + g.dueCount, 0);
  return {
    water: { groups, noHistory },
    feed,
    problems,
    tasks: dueTasks,
    tomorrow,
    counts: { water: waterDue, feed: feed.length, problems: problems.length },
  };
}

/** @param {Date} [now] */
export async function getToday(now = new Date()) {
  const [plants, profiles, locations, pests, inbox] = await Promise.all([
    plantRepository.listByStatus('active'),
    listCareProfiles(),
    listLocations(),
    listActivePests(),
    getInbox(now),
  ]);
  for (const pest of pests) {
    pest.lastTreatment = (await listTreatmentsForPest(pest.id))[0] ?? null;
  }
  const today = buildToday({ plants, profiles, locations, tasks: [...inbox.overdue, ...inbox.dueToday], pests }, now);
  for (const item of today.feed) {
    item.last = await lastFeeding(item.plant.id);
  }
  return today;
}
