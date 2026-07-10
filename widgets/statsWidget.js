/**
 * Garden stats widget (UI layer, L5) — FR-8.1.
 * Headline numbers from the analytics service.
 */

import { el } from '../utils/dom.js';
import { gardenStats } from '../services/analyticsService.js';
import { registerWidget } from './registry.js';

registerWidget({
  id: 'stats',
  title: 'Garden at a glance',
  defaultOrder: 3,
  refreshOn: [
    'plant:created', 'plant:deleted', 'plant:archived', 'events:logged',
    'image:added', 'image:removed', 'note:created', 'note:deleted',
    'batch:created', 'batch:stage-changed', 'harvest:logged', 'backup:restored',
  ],
  async render(container) {
    const stats = await gardenStats();
    const rows = [
      ['Active plants', stats.plantsActive],
      ['Events logged', stats.eventsLogged],
      ['Photos', stats.photos],
      ['Notes', stats.notes],
      ['Active sowings', stats.activeBatches],
    ];
    for (const [label, value] of rows) {
      container.append(
        el(
          'div',
          { className: 'status-row' },
          el('span', {}, label),
          el('span', { className: 'status-row__value' }, String(value)),
        ),
      );
    }
  },
});
