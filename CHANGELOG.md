# Changelog

All notable changes to GardenOS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versioning policy:
- **MAJOR** — new capability era per ROADMAP.md (AI, cloud, IoT…) or breaking data-schema change without automatic migration (should never happen).
- **MINOR** — new feature module or significant feature addition; may include an automatic schema migration.
- **PATCH** — fixes, performance, documentation, refactors with no behavior change.

Database schema versions are tracked independently in [DATABASE.md](DATABASE.md) §7 and referenced here whenever a release migrates the schema.

## [Unreleased]

### Added
- Complete project initialization: directory structure and full documentation set
  (README, PROJECT_REQUIREMENTS, ARCHITECTURE, ROADMAP, DATABASE, FEATURES,
  API_DESIGN, UI_GUIDELINES, CONTRIBUTING, LICENSE, TODO, ADR-0000 template,
  ADR-0001 technology stack, ADR-0002 storage strategy).
- Defined v1 IndexedDB schema (schema version 1) — design only, not yet implemented.
- Defined service interface contracts for weather, AI, storage, import/export,
  sync, and sensors — design only, not yet implemented.

- **v1.0 Foundation, increment 1** (documentation approved 2026-07-09):
  - Installable PWA shell: `index.html` app shell with strict CSP, web app
    manifest, app icon set (SVG source + 192/512/maskable PNG), root `sw.js`
    shim + `pwa/service-worker.js` with full app-shell precache, cache-first
    offline strategy, versioned caches, and consent-based update prompt.
  - Design system implementation: `styles/tokens.css` (dark default + light
    theme), `base.css`, `layout.css` (bottom nav ↔ sidebar responsive shell),
    `components.css` (nav, cards, buttons, fields, meter, toasts).
  - Platform core: hash router with params and focus management, internal
    event bus, DOM construction helpers (no-innerHTML policy), typed error
    hierarchy, local-only ring-buffer logger with global error capture,
    feature flags, constants.
  - Settings: validated LocalStorage wrapper; Settings page (theme with
    zero-flash pre-paint, units, week start), storage usage meter, persistent
    storage request; Dashboard page with live platform status.
  - Verification: all JS parse-checked (JavaScriptCore), service-worker
    precache list and ES import graph audited against disk, HTTP 200 sweep
    over the served shell. Live in-browser pass tracked as T-028.

### Notes
- v1.0 increment 2 (next): IndexedDB core, migration framework, repository
  base (T-017/T-018), Diagnostics view (T-021), then backup/restore
  (T-022–T-025) and the test harness (T-026) to close the v1.0 exit gate.
