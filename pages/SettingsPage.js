/**
 * Settings page (UI layer, L5) — FR-9.5, TODO T-019/T-020.
 * Appearance & preference settings (LocalStorage-backed), storage health,
 * and app information. Backup/Restore joins this screen in the next
 * v1.0 increment (T-022–T-025).
 */

import { el, svgIcon } from '../utils/dom.js';
import { getSetting, setSetting } from '../storage/settings.js';
import { showToast } from '../components/Toast.js';
import { confirmDialog } from '../components/ConfirmDialog.js';
import { triggerDownload, pickFile, shareOrDownload, canShareFiles } from '../components/fileTransfer.js';
import { APP_VERSION } from '../config/constants.js';
import { formatBytes, formatPercent } from '../utils/format.js';
import { logger } from '../utils/logger.js';
import {
  getStorageStatus,
  requestPersistentStorage,
} from '../services/storageStatusService.js';
import { getStorageStats } from '../services/imageService.js';
import { getCapability, requestPermission, announceDueTasks } from '../services/notificationService.js';
import { inspectArchive } from '../services/importService.js';
import {
  createBackup,
  restoreFromArchive,
  getBackupStatus,
} from '../services/backupService.js';

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
    notificationsSection(),
    section('Garden setup', [
      el(
        'div',
        { className: 'status-row' },
        el('span', {}, 'Garden locations'),
        el('a', { href: '#/locations' }, 'Manage'),
      ),
      el(
        'p',
        { className: 'text-small text-muted' },
        'Care profiles are assigned on each plant’s edit form; Karachi presets are built in.',
      ),
    ]),
    backupSection(),
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
        'All garden data stays on this device — nothing is uploaded anywhere. '
          + 'Backups are plain files you control.',
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

function backupSection() {
  const lastBackupValue = el('span', { className: 'status-row__value' }, 'Checking…');
  const statusRow = el(
    'div',
    { className: 'status-row' },
    el('span', {}, 'Last backup'),
    lastBackupValue,
  );

  const refreshStatus = async () => {
    try {
      const status = await getBackupStatus();
      if (status.lastBackupAt === null) {
        lastBackupValue.textContent = status.dataRecords > 0 ? 'Never — back up soon' : 'Never';
        lastBackupValue.classList.toggle('status-row__value--warn', status.dataRecords > 0);
      } else {
        const days = status.daysSince === 0 ? 'today' : `${status.daysSince} day(s) ago`;
        lastBackupValue.textContent = `${days} (${status.lastBackupAt.slice(0, 10)})`;
        lastBackupValue.classList.toggle('status-row__value--warn', status.reminderDue);
      }
    } catch (error) {
      lastBackupValue.textContent = 'Unavailable';
      logger.warn('Backup status unavailable', { error: error.message });
    }
  };
  refreshStatus();

  const sendLabel = canShareFiles() ? 'Send backup…' : 'Download backup';
  const downloadButton = el(
    'button',
    {
      className: 'btn btn--primary',
      onClick: async () => {
        downloadButton.disabled = true;
        try {
          const { blob, filename } = await createBackup();
          const result = await shareOrDownload(blob, filename);
          if (result !== 'cancelled') {
            showToast(result === 'shared' ? 'Backup sent' : 'Backup downloaded — keep a copy off this device');
          }
          refreshStatus();
        } catch (error) {
          logger.error('Backup failed', { error: error.message });
          showToast(`Backup failed: ${error.message}`);
        } finally {
          downloadButton.disabled = false;
        }
      },
    },
    sendLabel,
  );

  const restoreButton = el(
    'button',
    { className: 'btn', onClick: () => runRestoreFlow(refreshStatus) },
    'Restore from backup…',
  );

  return section('Backup & data', [
    statusRow,
    el(
      'p',
      { className: 'text-small text-muted' },
      'A backup is one file holding your entire garden: every plant, event, note, and photo.',
    ),
    el(
      'div',
      { className: 'card today-group' },
      el('strong', {}, 'See your phone garden on the computer'),
      el(
        'ol',
        { className: 'text-small' },
        el('li', {}, 'On the phone: tap "Send backup…" and pick Drive, email or WhatsApp.'),
        el('li', {}, 'On the computer: open the same GardenOS page, download that file.'),
        el('li', {}, 'In GardenOS on the computer: tap "Restore from backup…" and pick the file.'),
      ),
      el('p', { className: 'text-small text-muted' }, 'Log on the phone; the computer is for viewing. Restoring replaces what is on the device you restore to.'),
    ),
    el('div', { className: 'dialog__actions' }, restoreButton, downloadButton),
    selectField('Remind me to back up', 'backupReminderDays', [
      ['7', 'Every 7 days'],
      ['14', 'Every 14 days'],
      ['30', 'Every 30 days'],
      ['off', 'Never'],
    ]),
  ]);
}

/**
 * Guarded restore pipeline (NFR-4.4): pick → inspect/validate → explicit
 * confirmation naming the consequences → safety backup of current data →
 * atomic restore → reload into clean state.
 * @param {() => void} refreshStatus
 */
async function runRestoreFlow(refreshStatus) {
  const file = await pickFile('.json,application/json');
  if (!file) {
    return;
  }

  let inspection;
  try {
    inspection = await inspectArchive(await file.text());
  } catch (error) {
    showToast(error.message);
    return;
  }
  if (!inspection.checksumOk) {
    showToast('This backup file failed its integrity check — refusing to restore');
    return;
  }

  const { meta } = inspection;
  const totalRecords = Object.values(meta.counts).reduce((sum, n) => sum + n, 0);
  const confirmed = await confirmDialog({
    title: 'Replace all data with this backup?',
    body:
      `Backup from ${meta.createdAt.slice(0, 10)} (app v${meta.appVersion}, `
      + `${totalRecords} records). Everything currently in GardenOS will be replaced. `
      + 'A safety copy of the current data downloads first, and the app reloads when done.',
    confirmLabel: 'Replace everything',
    danger: true,
  });
  if (!confirmed) {
    return;
  }

  try {
    const current = await getBackupStatus();
    if (current.dataRecords > 0) {
      const safety = await createBackup();
      triggerDownload(safety.blob, safety.filename.replace('backup', 'pre-restore-safety'));
    }
    await restoreFromArchive(inspection.archive, inspection.checksumOk);
    showToast('Restore complete — reloading…');
    window.setTimeout(() => window.location.reload(), 900);
  } catch (error) {
    logger.error('Restore failed', { error: error.message });
    showToast(`Restore failed: ${error.message}`);
    refreshStatus();
  }
}

/** Task notifications (FR-4.5): capability display + permission request. */
function notificationsSection() {
  const stateValue = el('span', { className: 'status-row__value' }, '');
  const actionRow = el('div', {});

  const refresh = () => {
    const capability = getCapability();
    const labels = {
      granted: 'On — due tasks notify when the app opens',
      denied: 'Blocked in browser settings',
      unsupported: 'Not supported by this browser',
      'not-asked': 'Off',
    };
    stateValue.textContent = labels[capability];
    stateValue.classList.toggle('status-row__value--ok', capability === 'granted');
    actionRow.replaceChildren();
    if (capability === 'not-asked') {
      actionRow.append(
        el(
          'button',
          {
            className: 'btn btn--primary',
            onClick: async () => {
              const result = await requestPermission();
              showToast(result === 'granted' ? 'Notifications enabled' : 'Notifications stay off');
              announceDueTasks();
              refresh();
            },
          },
          'Enable notifications',
        ),
      );
    }
  };
  refresh();

  return section('Notifications', [
    el('div', { className: 'status-row' }, el('span', {}, 'Due-task notifications'), stateValue),
    el(
      'p',
      { className: 'text-small text-muted' },
      'GardenOS has no servers, so notifications fire when the app opens or is in use; the badge on the Tasks tab always shows the due count.',
    ),
    actionRow,
  ]);
}

function storageSection() {
  // Width is set through the CSSOM, not a style attribute — our CSP
  // (style-src 'self') blocks injected style attributes.
  const meterFill = el('div', { className: 'meter__fill' });
  meterFill.style.width = '0%';
  const usageText = el('p', { className: 'text-small text-muted' }, 'Checking storage…');
  const photosText = el('p', { className: 'text-small text-muted' }, '');
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

    try {
      const photos = await getStorageStats();
      photosText.textContent = photos.count > 0
        ? `Photos: ${photos.count} using ${formatBytes(photos.totalBytes)}`
        : 'Photos: none yet';
    } catch {
      photosText.textContent = '';
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

  return section('Storage', [el('div', { className: 'meter' }, meterFill), usageText, photosText, persistRow]);
}
