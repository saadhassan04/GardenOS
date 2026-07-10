/**
 * Platform status widget (UI layer, L5).
 * The v1.0 foundation health readout: version, offline readiness, storage
 * protection and usage. Lived on the Dashboard page pre-v1.4; now it's an
 * ordinary (default-last) widget.
 */

import { el } from '../utils/dom.js';
import { APP_VERSION } from '../config/constants.js';
import { formatBytes, formatPercent } from '../utils/format.js';
import { getStorageStatus } from '../services/storageStatusService.js';
import { registerWidget } from './registry.js';

registerWidget({
  id: 'status',
  title: 'Platform status',
  defaultOrder: 8,
  refreshOn: ['storage:quota-warning', 'backup:created', 'backup:restored'],
  async render(container) {
    const row = (label, value, modifier = '') =>
      el(
        'div',
        { className: 'status-row' },
        el('span', {}, label),
        el('span', { className: `status-row__value ${modifier}`.trim() }, value),
      );

    container.append(row('App version', APP_VERSION));

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      container.append(
        registration?.active
          ? row('Offline ready', 'Yes — works without internet', 'status-row__value--ok')
          : row('Offline ready', 'Preparing… reload once to finish'),
      );
    } else {
      container.append(row('Offline ready', 'Not supported by this browser'));
    }

    const status = await getStorageStatus();
    if (status.persisted !== null) {
      container.append(
        status.persisted
          ? row('Storage protected', 'Yes', 'status-row__value--ok')
          : row('Storage protected', 'Not yet — see Settings', 'status-row__value--warn'),
      );
    }
    if (status.usageBytes !== null) {
      const percent = status.ratio === null ? '' : ` (${formatPercent(status.ratio)} of quota)`;
      container.append(row('Storage used', `${formatBytes(status.usageBytes)}${percent}`));
    }
  },
});
