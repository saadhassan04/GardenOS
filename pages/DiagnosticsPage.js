/**
 * Diagnostics page (UI layer, L5) — ARCHITECTURE.md §13, TODO T-021.
 * Local-only introspection: install metadata, migration history, feature
 * flags, per-store record counts, and the logger ring buffer. Reached from
 * Settings → About; deliberately not in primary navigation.
 */

import { el, svgIcon } from '../utils/dom.js';
import { APP_NAME, APP_VERSION, DB_SCHEMA_VERSION } from '../config/constants.js';
import { allFlags } from '../config/featureFlags.js';
import { getLogEntries } from '../utils/logger.js';
import { getAppMeta, getStoreCounts } from '../database/db.js';

/** @returns {HTMLElement} */
export function renderDiagnosticsPage() {
  const page = el('div', {});

  page.append(
    el(
      'header',
      { className: 'page-header' },
      svgIcon('note', { size: 28 }),
      el('h1', {}, 'Diagnostics'),
    ),
  );

  const appCard = el('div', { className: 'card' });
  const migrationsCard = el('div', { className: 'card' });
  const flagsCard = el('div', { className: 'card' });
  const countsCard = el('div', { className: 'card' });
  const logCard = el('div', { className: 'card stack' });

  page.append(
    section('Application', appCard),
    section('Migrations', migrationsCard),
    section('Feature flags', flagsCard),
    section('Database record counts', countsCard),
    section('Recent log', logCard),
  );

  fillApplication(appCard, migrationsCard);
  fillFlags(flagsCard);
  fillCounts(countsCard);
  fillLog(logCard);

  return page;
}

function section(title, card) {
  return el(
    'section',
    { className: 'page-section' },
    el('span', { className: 'text-caption' }, title),
    card,
  );
}

function row(label, value, modifier = '') {
  return el(
    'div',
    { className: 'status-row' },
    el('span', {}, label),
    el('span', { className: `status-row__value ${modifier}`.trim() }, value),
  );
}

async function fillApplication(appCard, migrationsCard) {
  appCard.append(row(`${APP_NAME} version`, APP_VERSION));
  appCard.append(row('Schema version (code)', String(DB_SCHEMA_VERSION)));

  try {
    const meta = await getAppMeta();
    appCard.append(
      row('Schema version (database)', String(meta.schemaVersion ?? '—')),
      row('Install id', meta.installId ?? '—'),
      row('Installed at', meta.installedAt ?? '—'),
      row('Last backup', meta.lastBackupAt ?? 'Never', meta.lastBackupAt ? '' : 'status-row__value--warn'),
    );

    const migrationLog = meta.migrationLog ?? [];
    if (migrationLog.length === 0) {
      migrationsCard.append(el('p', { className: 'text-muted text-small' }, 'No migrations recorded.'));
    }
    for (const entry of migrationLog) {
      migrationsCard.append(
        row(`v${entry.from} → v${entry.to} (app ${entry.appVersion})`, entry.at),
      );
    }
  } catch (error) {
    appCard.append(row('Database', `Unavailable: ${error.message}`, 'status-row__value--warn'));
  }
}

function fillFlags(card) {
  for (const [name, enabled] of Object.entries(allFlags())) {
    card.append(row(name, enabled ? 'on' : 'off', enabled ? 'status-row__value--ok' : ''));
  }
}

async function fillCounts(card) {
  try {
    const counts = await getStoreCounts();
    for (const [store, count] of Object.entries(counts)) {
      card.append(row(store, String(count)));
    }
    card.append(
      el(
        'p',
        { className: 'text-small text-muted' },
        'Counts include soft-deleted records awaiting purge.',
      ),
    );
  } catch (error) {
    card.append(row('Counts', `Unavailable: ${error.message}`, 'status-row__value--warn'));
  }
}

function fillLog(card) {
  const entries = getLogEntries();
  if (entries.length === 0) {
    card.append(el('p', { className: 'text-muted text-small' }, 'No log entries this session.'));
    return;
  }
  for (const entry of entries.slice(-50).reverse()) {
    card.append(
      el(
        'p',
        { className: 'text-small' },
        el('span', { className: 'text-caption' }, `${entry.level} `),
        el('span', { className: 'text-muted' }, `${entry.at.slice(11, 19)} `),
        entry.message,
      ),
    );
  }
}
