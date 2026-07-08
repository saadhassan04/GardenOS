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
import { mountNavigation } from '../components/Navigation.js';
import { showToast } from '../components/Toast.js';
import { renderDashboardPage } from '../pages/DashboardPage.js';
import { renderSettingsPage } from '../pages/SettingsPage.js';
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
  registerRoute('/settings', 'Settings', renderSettingsPage);
  setNotFound(renderNotFoundPage);
}

function bootstrap() {
  installGlobalErrorCapture();
  logger.info(`GardenOS v${APP_VERSION} starting`);

  registerServiceWorker();

  applyTheme(getSetting('theme'));
  bus.on('settings:changed', ({ key, value }) => {
    if (key === 'theme') {
      applyTheme(value);
    }
  });

  registerRoutes();

  mountNavigation(document.getElementById('app-nav'), [
    { label: 'Dashboard', path: '/', icon: 'leaf' },
    { label: 'Settings', path: '/settings', icon: 'gear' },
  ]);

  if (!window.location.hash) {
    window.location.hash = '#/';
  }
  startRouter(document.getElementById('app-main'));

  logger.info('GardenOS ready');
}

bootstrap();
