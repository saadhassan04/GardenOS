/**
 * GardenOS service worker (Platform layer, L1) — NFR-1, TODO T-016.
 * Strategy: precache the complete app shell at install; serve cache-first
 * for same-origin GETs so the app is fully functional offline after the
 * first load. Loaded via the root shim /sw.js, so all URLs here resolve
 * against the app root.
 *
 * CACHE_VERSION must be bumped whenever any precached file changes —
 * that is what triggers the in-app "Update available" prompt.
 * PRECACHE_URLS must list every file the shell needs (kept in sync by the
 * release checklist, CONTRIBUTING.md §6).
 */

/* eslint-env serviceworker */

const CACHE_VERSION = 'gardenos-shell-v0.3.0';

const PRECACHE_URLS = [
  './',
  './index.html',
  './styles/tokens.css',
  './styles/base.css',
  './styles/layout.css',
  './styles/components.css',
  './scripts/theme-init.js',
  './scripts/app.js',
  './config/constants.js',
  './config/featureFlags.js',
  './utils/dom.js',
  './utils/errors.js',
  './utils/format.js',
  './utils/logger.js',
  './utils/uuid.js',
  './utils/checksum.js',
  './utils/blobCodec.js',
  './storage/settings.js',
  './hooks/bus.js',
  './hooks/router.js',
  './models/envelope.js',
  './database/db.js',
  './database/idb.js',
  './database/stores.js',
  './database/Repository.js',
  './database/migrations/index.js',
  './database/migrations/001_initial_schema.js',
  './services/storageStatusService.js',
  './services/archiveCodec.js',
  './services/exportService.js',
  './services/importService.js',
  './services/backupService.js',
  './components/Navigation.js',
  './components/Toast.js',
  './components/ConfirmDialog.js',
  './components/fileTransfer.js',
  './pages/DashboardPage.js',
  './pages/SettingsPage.js',
  './pages/DiagnosticsPage.js',
  './pages/NotFoundPage.js',
  './pwa/manifest.json',
  './assets/icons/sprite.svg',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from previous versions, then take control of open pages.
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith('gardenos-shell-') && name !== CACHE_VERSION)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return; // Network-only for non-GET and cross-origin (future weather API).
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: request.mode === 'navigate' });
      if (cached) {
        return cached;
      }
      try {
        return await fetch(request);
      } catch (error) {
        // Offline and uncached: navigations fall back to the app shell,
        // where the hash router resolves the screen.
        if (request.mode === 'navigate') {
          const shell = await caches.match('./index.html');
          if (shell) {
            return shell;
          }
        }
        throw error;
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  // Sent by the "Update" toast action (scripts/app.js) — user consented.
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
