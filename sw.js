/**
 * Service worker root shim.
 * A service worker can only control pages at or below its own path, and
 * static hosts can't send the Service-Worker-Allowed header — so this file
 * must live at the app root. All real logic stays in pwa/service-worker.js
 * per the folder responsibilities in ARCHITECTURE.md §4.
 */
importScripts('pwa/service-worker.js');
