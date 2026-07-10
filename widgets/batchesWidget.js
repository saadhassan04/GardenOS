/**
 * Active sowings widget (UI layer, L5) — FR-8.1.
 */

import { el } from '../utils/dom.js';
import { listBatches } from '../services/kitchenGardenService.js';
import { STAGE_LABELS } from '../models/SowingBatch.js';
import { registerWidget } from './registry.js';

const DAY_MS = 86_400_000;

registerWidget({
  id: 'batches',
  title: 'Kitchen garden',
  defaultOrder: 4,
  refreshOn: ['batch:created', 'batch:stage-changed', 'backup:restored'],
  async render(container) {
    const batches = (await listBatches()).slice(0, 5);
    if (batches.length === 0) {
      container.append(
        el('p', { className: 'text-small text-muted' }, 'Nothing sown right now. ', el('a', { href: '#/kitchen' }, 'Check the calendar')),
      );
      return;
    }
    for (const batch of batches) {
      const days = Math.max(0, Math.floor((Date.now() - Date.parse(batch.sownAt)) / DAY_MS));
      container.append(
        el(
          'div',
          { className: 'status-row' },
          el('a', { href: '#/kitchen' }, batch.variety ? `${batch.crop} · ${batch.variety}` : batch.crop),
          el('span', { className: 'status-row__value' }, `${STAGE_LABELS[batch.stage]} · day ${days}`),
        ),
      );
    }
  },
});
