/**
 * Settings page (UI layer, L5) — FR-9.5, TODO T-019/T-020.
 * Appearance & preference settings (LocalStorage-backed), storage health,
 * and app information. Backup/Restore joins this screen in the next
 * v1.0 increment (T-022–T-025).
 */

import { el, svgIcon } from '../utils/dom.js';
import { getSetting, setSetting } from '../storage/settings.js';
import { showToast } from '../components/Toast.js';
import { APP_VERSION } from '../config/constants.js';
import { formatBytes, formatPercent } from '../utils/format.js';
import {
  getStorageStatus,
  requestPersistentStorage,
} from '../services/storageStatusService.js';

/** @returns {HTMLElement} */
export function renderSettingsPage() {
  const page = el('div', {});

  page.append(
    el(
      'header',
      { className: 'page-header' },
      svgIcon('gear', { size: 28 }),
      el('h1', {}, 'Settings'),
    ),
  );

  page.append(
    section('Appearance', [
      selectField('Theme', 'theme', [
        ['dark', 'Dark'],
        ['light', 'Light'],
        ['auto', 'Follow system'],
      ]),
    ]),
    section('Preferences', [
      selectField('Measurement units', 'units', [
        ['metric', 'Metric (cm, kg, °C)'],
        ['imperial', 'Imperial (in, lb, °F)'],
      ]),
      selectField('Week starts on', 'weekStart', [
        ['monday', 'Monday'],
        ['sunday', 'Sunday'],
        ['saturday', 'Saturday'],
      ]),
    ]),
    storageSection(),
    section('About', [
      el(
        'div',
        { className: 'status-row' },
        el('span', {}, 'Version'),
        el('span', { className: 'status-row__value' }, APP_VERSION),
      ),
      el(
        'div',
        { className: 'status-row' },
        el('span', {}, 'Diagnostics'),
        el('a', { href: '#/diagnostics' }, 'View'),
      ),
      el(
        'p',
        { className: 'text-small text-muted' },
        'All garden data stays on this device. Backup & restore arrive in the next '
          + 'Foundation increment, before any plant data is ever entered.',
      ),
    ]),
  );

  return page;
}

/**
 * @param {string} title
 * @param {HTMLElement[]} children
 */
function section(title, children) {
  return el(
    'section',
    { className: 'page-section' },
    el('span', { className: 'text-caption' }, title),
    el('div', { className: 'card stack' }, ...children),
  );
}

/**
 * A labeled <select> bound to one settings key.
 * @param {string} label
 * @param {string} key settings schema key
 * @param {[string, string][]} options [value, label] pairs
 */
function selectField(label, key, options) {
  const id = `setting-${key}`;
  const select = el(
    'select',
    {
      className: 'field__control',
      id,
      onChange: (event) => {
        setSetting(key, event.target.value);
        showToast(`${label} updated`);
      },
    },
    ...options.map(([value, text]) => el('option', { value }, text)),
  );
  select.value = getSetting(key);

  return el('div', { className: 'field' }, el('label', { className: 'field__label', for: id }, label), select);
}

function storageSection() {
  // Width is set through the CSSOM, not a style attribute — our CSP
  // (style-src 'self') blocks injected style attributes.
  const meterFill = el('div', { className: 'meter__fill' });
  meterFill.style.width = '0%';
  const usageText = el('p', { className: 'text-small text-muted' }, 'Checking storage…');
  const persistRow = el('div', { className: 'stack' });

  const refresh = async () => {
    const status = await getStorageStatus();

    if (status.usageBytes !== null && status.quotaBytes !== null) {
      meterFill.style.width = formatPercent(status.ratio ?? 0);
      meterFill.classList.toggle('meter__fill--warn', status.level === 'warn');
      meterFill.classList.toggle('meter__fill--danger', status.level === 'danger');
      usageText.textContent =
        `${formatBytes(status.usageBytes)} used of ${formatBytes(status.quotaBytes)} available`;
    } else {
      usageText.textContent = 'This browser does not report storage usage.';
    }

    persistRow.replaceChildren();
    if (status.persisted === true) {
      persistRow.append(
        el(
          'p',
          { className: 'text-small' },
          '✓ Protected: the browser will not auto-delete your garden data.',
        ),
      );
    } else if (status.persisted === false) {
      persistRow.append(
        el(
          'p',
          { className: 'text-small text-muted' },
          'Your data could be evicted if the device runs low on space. '
            + 'Ask the browser to protect it:',
        ),
        el(
          'button',
          {
            className: 'btn btn--primary',
            onClick: async () => {
              const granted = await requestPersistentStorage();
              showToast(
                granted
                  ? 'Storage is now protected'
                  : 'Browser declined for now — installing the app usually grants this',
              );
              refresh();
            },
          },
          'Protect my data',
        ),
      );
    }
  };

  refresh();

  return section('Storage', [el('div', { className: 'meter' }, meterFill), usageText, persistRow]);
}
