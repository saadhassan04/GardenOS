/**
 * Care activity charts widget (UI layer, L5) — T-072, FR-8.1.
 * Watering frequency (14 days) and the all-events activity heatmap
 * (12 weeks), drawn with the in-house canvas primitives.
 */

import { el } from '../utils/dom.js';
import { barChart, calendarHeatmap } from '../components/charts.js';
import { dailyEventCounts, dailyActivity } from '../services/analyticsService.js';
import { registerWidget } from './registry.js';

registerWidget({
  id: 'careCharts',
  title: 'Care activity',
  defaultOrder: 7,
  wide: true,
  refreshOn: ['events:logged', 'backup:restored'],
  async render(container) {
    const [watering, activity] = await Promise.all([
      dailyEventCounts({ type: 'watering', days: 14 }),
      dailyActivity({ days: 84 }),
    ]);

    const wateringTotal = watering.reduce((sum, d) => sum + d.count, 0);
    container.append(
      el('p', { className: 'text-small text-muted' }, `Waterings, last 14 days (${wateringTotal} total)`),
      barChart(watering, {
        ariaLabel: `Watering events per day over the last 14 days, ${wateringTotal} total`,
      }),
      el('p', { className: 'text-small text-muted' }, 'All care events, last 12 weeks'),
      calendarHeatmap(activity, {
        ariaLabel: 'Calendar heatmap of care events over the last 12 weeks',
      }),
    );
  },
});
