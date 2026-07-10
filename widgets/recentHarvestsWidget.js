/**
 * Recent harvests widget (UI layer, L5) — FR-8.1.
 */

import { el } from '../utils/dom.js';
import { listRecentHarvests } from '../services/kitchenGardenService.js';
import { relativeDate } from '../utils/dates.js';
import { registerWidget } from './registry.js';

registerWidget({
  id: 'recentHarvests',
  title: 'Recent harvests',
  defaultOrder: 5,
  refreshOn: ['harvest:logged', 'backup:restored'],
  async render(container) {
    const harvests = await listRecentHarvests(5);
    if (harvests.length === 0) {
      container.append(
        el('p', { className: 'text-small text-muted' }, 'No harvests yet — they land here basket by basket.'),
      );
      return;
    }
    for (const harvest of harvests) {
      container.append(
        el(
          'div',
          { className: 'status-row' },
          el('span', {}, harvest.crop),
          el(
            'span',
            { className: 'status-row__value' },
            `${harvest.quantity} ${harvest.unit} · ${relativeDate(harvest.harvestedAt)}`,
          ),
        ),
      );
    }
  },
});
