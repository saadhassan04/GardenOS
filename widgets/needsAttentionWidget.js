/**
 * Needs-attention widget (UI layer, L5) — FR-8.1.
 * Plants whose watering is due per their Karachi care profile (or
 * override), most overdue first, with one-tap watering + Undo.
 */

import { el, svgIcon } from '../utils/dom.js';
import { showToast } from '../components/Toast.js';
import { listNeedsWatering } from '../services/careProfileService.js';
import { logEvent, undoBatch } from '../services/careEventService.js';
import { registerWidget } from './registry.js';

const MAX_ROWS = 8;

registerWidget({
  id: 'needsAttention',
  title: 'Needs attention',
  defaultOrder: 1,
  refreshOn: ['events:logged', 'plant:created', 'plant:updated', 'plant:deleted'],
  async render(container) {
    const due = await listNeedsWatering();
    if (due.length === 0) {
      container.append(
        el('p', { className: 'text-small text-muted' }, 'All watered per schedule. The garden approves.'),
      );
      return;
    }
    for (const { plant, everyDays, daysSince } of due.slice(0, MAX_ROWS)) {
      container.append(
        el(
          'div',
          { className: 'status-row' },
          el(
            'span',
            {},
            el('a', { href: `#/plants/${plant.id}` }, plant.name),
            el(
              'span',
              { className: 'text-small text-muted' },
              daysSince === null
                ? ' — never watered'
                : ` — ${daysSince} days ago (every ${everyDays})`,
            ),
          ),
          el(
            'button',
            {
              className: 'btn',
              'aria-label': `Log watering for ${plant.name}`,
              onClick: async () => {
                const { batchId } = await logEvent(plant.id, 'watering');
                showToast(`${plant.name} watered`, {
                  actionLabel: 'Undo',
                  onAction: async () => {
                    await undoBatch(batchId);
                    showToast('Undone');
                  },
                });
              },
            },
            svgIcon('drop', { size: 18 }),
          ),
        ),
      );
    }
    if (due.length > MAX_ROWS) {
      container.append(
        el('p', { className: 'text-small text-muted' }, `…and ${due.length - MAX_ROWS} more.`),
      );
    }
  },
});
