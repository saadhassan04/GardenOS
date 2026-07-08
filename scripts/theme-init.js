/**
 * Theme pre-paint initializer (Platform layer).
 *
 * Classic script loaded synchronously in <head> so the saved theme is applied
 * before first paint — no flash of wrong theme (UI_GUIDELINES.md §9).
 * Cannot use ES imports here, so the settings storage key is duplicated;
 * it MUST stay in sync with storage/settings.js (STORAGE_KEY).
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'gardenos.settings.v1';
  var mediaQuery = window.matchMedia('(prefers-color-scheme: light)');

  function savedTheme() {
    try {
      var settings = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      return (settings && settings.theme) || 'dark';
    } catch (error) {
      return 'dark';
    }
  }

  function apply(theme) {
    var resolved = theme === 'auto' ? (mediaQuery.matches ? 'light' : 'dark') : theme;
    document.documentElement.setAttribute('data-theme', resolved);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', resolved === 'light' ? '#F6F8F4' : '#0F1511');
    }
  }

  apply(savedTheme());

  // Follow OS changes while in "auto" mode. Runtime theme switching from the
  // Settings page is handled by scripts/app.js; this only covers OS flips.
  mediaQuery.addEventListener('change', function () {
    if (savedTheme() === 'auto') {
      apply('auto');
    }
  });
})();
