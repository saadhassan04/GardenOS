/**
 * GardenOS application bootstrap — ARCHITECTURE.md §5.4 startup sequence.
 * Order matters: error capture → service worker → theme → routing → nav.
 * Step 3 (IndexedDB open + migrations) joins this sequence in the next
 * v1.0 increment (T-017); persistent storage is requested from Settings
 * and automatically once data exists.
 */

import { logger, installGlobalErrorCapture } from '../utils/logger.js';
import { bus } from '../hooks/bus.js';
import { registerRoute, setNotFound, startRouter } from '../hooks/router.js';
import { getSetting } from '../storage/settings.js';
import { openDatabase } from '../database/db.js';
import { getBackupStatus } from '../services/backupService.js';
import { mountNavigation } from '../components/Navigation.js';
import { showToast } from '../components/Toast.js';
import { renderDashboardPage } from '../pages/DashboardPage.js';
import { renderPlantsPage } from '../pages/PlantsPage.js';
import { renderPlantFormPage } from '../pages/PlantFormPage.js';
import { renderPlantDetailPage } from '../pages/PlantDetailPage.js';
import { renderNotesPage } from '../pages/NotesPage.js';
import { renderLocationsPage } from '../pages/LocationsPage.js';
import { ensureSeededCareProfiles } from '../services/careProfileService.js';
import { renderNoteFormPage } from '../pages/NoteFormPage.js';
import { renderSettingsPage } from '../pages/SettingsPage.js';
import { renderDiagnosticsPage } from '../pages/DiagnosticsPage.js';
import { renderNotFoundPage } from '../pages/NotFoundPage.js';
import { APP_VERSION } from '../config/constants.js';

/**
 * Apply a theme choice at runtime (Settings changes). The pre-paint pass is
 * scripts/theme-init.js; this mirrors its resolution logic for live updates.
 * @param {'dark'|'light'|'auto'} theme
 */
function applyTheme(theme) {
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const resolved = theme === 'auto' ? (prefersLight ? 'light' : 'dark') : theme;
  document.documentElement.setAttribute('data-theme', resolved);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'light' ? '#F6F8F4' : '#0F1511');
}

/**
 * Register the service worker and wire the in-app update prompt
 * (ARCHITECTURE.md §13: never silently reload).
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    logger.warn('Service workers unsupported; offline mode unavailable');
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');

    registration.addEventListener('updatefound', () => {
      const incoming = registration.installing;
      if (!incoming) {
        return;
      }
      incoming.addEventListener('statechange', () => {
        // "installed" with an existing controller = a new version is waiting.
        if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
          showToast('A new version of GardenOS is ready', {
            sticky: true,
            actionLabel: 'Update',
            onAction: () => incoming.postMessage({ type: 'SKIP_WAITING' }),
          });
        }
      });
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloading) {
        reloading = true;
        window.location.reload();
      }
    });
  } catch (error) {
    logger.error('Service worker registration failed', { error: error.message });
  }
}

function registerRoutes() {
  registerRoute('/', 'Dashboard', renderDashboardPage);
  registerRoute('/plants', 'Plants', renderPlantsPage);
  registerRoute('/plants/new', 'Add plant', renderPlantFormPage);
  registerRoute('/plants/:id', 'Plant', renderPlantDetailPage);
  registerRoute('/plants/:id/edit', 'Edit plant', renderPlantFormPage);
  registerRoute('/notes', 'Notes', renderNotesPage);
  registerRoute('/notes/new', 'Add note', renderNoteFormPage);
  registerRoute('/notes/:id/edit', 'Edit note', renderNoteFormPage);
  registerRoute('/locations', 'Locations', renderLocationsPage);
  registerRoute('/settings', 'Settings', renderSettingsPage);
  registerRoute('/diagnostics', 'Diagnostics', renderDiagnosticsPage);
  setNotFound(renderNotFoundPage);
}

async function bootstrap() {
  installGlobalErrorCapture();
  logger.info(`GardenOS v${APP_VERSION} starting`);

  registerServiceWorker();

  // Step 3 of the startup sequence (ARCHITECTURE.md §5.4): open the database
  // and run pending migrations before any screen renders. If this fails the
  // shell still loads — Settings and Diagnostics must stay reachable so the
  // user can inspect the failure and (soon) restore a backup.
  try {
    await openDatabase();
    // Karachi care-profile presets, first run only (T-039); user data is
    // never overwritten.
    await ensureSeededCareProfiles();
  } catch (error) {
    logger.error('Database unavailable', { error: error.message });
    showToast('Garden database could not be opened — see Diagnostics', {
      sticky: true,
      actionLabel: 'Open',
      onAction: () => {
        window.location.hash = '#/diagnostics';
      },
    });
  }

  applyTheme(getSetting('theme'));
  bus.on('settings:changed', ({ key, value }) => {
    if (key === 'theme') {
      applyTheme(value);
    }
  });

  registerRoutes();

  mountNavigation(document.getElementById('app-nav'), [
    { label: 'Dashboard', path: '/', icon: 'home' },
    { label: 'Plants', path: '/plants', icon: 'leaf' },
    { label: 'Notes', path: '/notes', icon: 'note' },
    { label: 'Settings', path: '/settings', icon: 'gear' },
  ]);

  if (!window.location.hash) {
    window.location.hash = '#/';
  }
  startRouter(document.getElementById('app-main'));

  checkBackupReminder();
  logger.info('GardenOS ready');
}

/** Boot-time backup reminder (FR-9.4). Fire-and-forget; never blocks startup. */
async function checkBackupReminder() {
  try {
    const status = await getBackupStatus();
    if (status.reminderDue) {
      const ago = status.daysSince === null ? 'never been backed up' : `not been backed up for ${status.daysSince} days`;
      showToast(`Your garden data has ${ago}`, {
        sticky: true,
        actionLabel: 'Back up',
        onAction: () => {
          window.location.hash = '#/settings';
        },
      });
    }
  } catch (error) {
    logger.warn('Backup reminder check failed', { error: error.message });
  }
}

bootstrap();
