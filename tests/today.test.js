/**
 * Today read-model test — buildToday is pure, so we feed it plain objects
 * and pin the day boundaries (PHASE2_HANDOFF §5.1, D2/D3).
 */

import { test, assert, assertEqual } from './testKit.js';
import { buildToday } from '../services/todayService.js';

const NOW = new Date(2026, 5, 10, 14, 0, 0); // 10 Jun 2026 14:00 local (summer)

const ago = (days, hour = 8) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

function plant(name, wateredAt, over = {}) {
  return {
    id: name, name, locationId: 'roof', careProfileId: null,
    careOverrides: { wateringEveryDays: 2, ...over.careOverrides },
    derived: { lastWateredAt: wateredAt, lastFertilizedAt: over.fed ?? null },
  };
}

test('should bucket plants into overdue, due, done-today, no-history and tomorrow', () => {
  const today = buildToday({
    plants: [
      plant('Overdue', ago(4)),
      plant('DueToday', ago(2)),
      plant('Done', ago(0)),
      plant('Tomorrow', ago(1)),
      plant('Fresh', ago(0, 13), { careOverrides: { wateringEveryDays: 5 } }),
      plant('Unknown', null),
      plant('Fed', ago(0), { careOverrides: { wateringEveryDays: 9, fertilizeEveryDays: 30 }, fed: ago(34) }),
      plant('Never fed', ago(0), { careOverrides: { wateringEveryDays: 9, fertilizeEveryDays: 30 } }),
    ],
    profiles: [],
    locations: [{ id: 'roof', name: 'Rooftop' }],
    tasks: [{ taskType: 'watering', id: 'w' }, { taskType: 'custom', id: 'c' }],
    pests: [
      { id: 'p1', pestType: 'aphid', plantIds: ['Overdue'], lastTreatment: { appliedAt: ago(1) } },
      { id: 'p2', pestType: 'mite', plantIds: ['Done'], lastTreatment: null },
    ],
  }, NOW);

  const [group] = today.water.groups;
  assertEqual(group.location, 'Rooftop');
  assertEqual(group.items.map((i) => i.plant.name).join(','), 'Overdue,DueToday,Done,Fed,Fresh,Never fed'); // done-today rows sort last
  assertEqual(group.items[0].overdueDays, 2);
  assertEqual(group.items[1].overdueDays, 0);
  assert(group.items[2].done, 'watered since midnight counts as done');
  assertEqual(today.counts.water, 2);
  assertEqual(today.counts.waterTotal, 6); // 2 due + 4 done today
  assertEqual(today.water.noHistory.map((p) => p.name).join(), 'Unknown');
  assertEqual(today.tomorrow.water, 1);
  assertEqual(today.feed.map((f) => f.plant.name).join(), 'Fed');
  assertEqual(today.tasks.map((t) => t.id).join(), 'c');
  assertEqual(today.problems.map((p) => p.pest.id).join(), 'p2,p1'); // untreated first
});
