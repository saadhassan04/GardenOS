/**
 * Dashboard page (UI layer, L5) — v1.0 Foundation edition.
 * Shows real platform status (offline readiness, storage, persistence) and
 * what arrives next per the roadmap. The widget-based dashboard replaces the
 * status portion in v1.4 (FR-8); this page keeps the same route.
 */

import { el, svgIcon } from '../utils/dom.js';
import { APP_NAME, APP_VERSION } from '../config/constants.js';
import { formatBytes, formatPercent } from '../utils/format.js';
import { getStorageStatus } from '../services/storageStatusService.js';

/** @returns {HTMLElement} */
export function renderDashboardPage() {
  const page = el('div', {});

  page.append(
    el(
      'header',
      { className: 'page-header' },
      svgIcon('leaf', { size: 28 }),
      el('h1', {}, 'Dashboard'),
    ),
  );

  page.append(
    el(
      'section',
      { className: 'page-section card' },
      el('h3', { className: 'card__title' }, `Welcome to ${APP_NAME}`),
      el(
        'p',
        { className: 'text-muted' },
        `This is the v${APP_VERSION} Foundation build: the offline-first shell your `
          + 'garden data will live in. The Plant Manager arrives in v1.1 — from then on, '
          + 'every plant, watering, and harvest gets recorded here.',
      ),
    ),
  );

  const statusList = el('div', { className: 'card' });
  page.append(
    el(
      'section',
      { className: 'page-section' },
      el('span', { className: 'text-caption' }, 'Platform status'),
      statusList,
    ),
  );

  statusList.append(statusRow('App version', el('span', { className: 'status-row__value' }, APP_VERSION)));

  const offlineValue = el('span', { className: 'status-row__value' }, 'Checking…');
  statusList.append(statusRow('Offline ready', offlineValue));

  const persistedValue = el('span', { className: 'status-row__value' }, 'Checking…');
  statusList.append(statusRow('Storage protected', persistedValue));

  const usageValue = el('span', { className: 'status-row__value' }, 'Checking…');
  statusList.append(statusRow('Storage used', usageValue));

  fillOfflineStatus(offlineValue);
  fillStorageStatus(persistedValue, usageValue);

  return page;
}

function statusRow(label, valueNode) {
  return el('div', { className: 'status-row' }, el('span', {}, label), valueNode);
}

async function fillOfflineStatus(valueNode) {
  if (!('serviceWorker' in navigator)) {
    valueNode.textContent = 'Not supported by this browser';
    return;
  }
  const registration = await navigator.serviceWorker.getRegistration();
  if (registration?.active) {
    valueNode.textContent = 'Yes — works without internet';
    valueNode.classList.add('status-row__value--ok');
  } else {
    valueNode.textContent = 'Preparing… reload once to finish';
  }
}

async function fillStorageStatus(persistedNode, usageNode) {
  const status = await getStorageStatus();

  if (status.persisted === null) {
    persistedNode.textContent = 'Unknown';
  } else if (status.persisted) {
    persistedNode.textContent = 'Yes';
    persistedNode.classList.add('status-row__value--ok');
  } else {
    persistedNode.textContent = 'Not yet — see Settings';
    persistedNode.classList.add('status-row__value--warn');
  }

  if (status.usageBytes === null) {
    usageNode.textContent = 'Unknown';
  } else {
    const percent = status.ratio === null ? '' : ` (${formatPercent(status.ratio)} of quota)`;
    usageNode.textContent = `${formatBytes(status.usageBytes)}${percent}`;
  }
}
