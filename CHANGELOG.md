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

- **v1.0 Foundation, increment 2**:
  - IndexedDB core (`database/`): connection manager with shared connection,
    version-change handling, and install/migration metadata in `appMeta`;
    forward-only migration framework; migration 001 creating all 17 stores
    (incl. reserved `analyses`, `weatherCache`, `sensorReadings`, `oplog`)
    with every index from DATABASE.md.
  - `Repository` base class: envelope stamping (UUIDv4, timestamps,
    soft-delete tombstones), atomic `addMany`, merge-safe `update`,
    tombstone-aware reads, cursor-paginated `query` (offset-resume — correct
    for all directions and duplicate index keys), streamed `exportAll`
    including tombstones + primary keys, transactional `importBatch`
    (merge/replace) — the backup/restore and future-sync substrate.
  - Diagnostics view (Settings → About → View): install id, schema versions,
    migration log, feature flags, per-store counts, session log ring buffer.
  - Database opens (with migrations) during bootstrap before first render;
    failure degrades gracefully with a sticky toast into Diagnostics.
  - Browser test harness (`tests/index.html`) + 10 integration tests running
    the migration and Repository against real IndexedDB in a disposable
    `gardenos-test` database.
  - DATABASE.md: documented that indexed boolean-like fields are stored as
    0/1 (`notes.pinned`, `oplog.synced`) — IndexedDB cannot index booleans.

- **v1.0 Foundation, increment 3**:
  - Backup archive format v1 (`services/archiveCodec.js`): single open JSON
    file, SHA-256 checksum over collections, inline base64 blob fields,
    out-of-line key preservation; documented in API_DESIGN.md §7.
  - Export service: `exportFull()` streams every store — tombstones and
    binary data included — into a deterministic archive.
  - Import service: `inspectArchive()` validates format/version/structure
    and recomputes the checksum before anything is touched;
    `importCollections()` imports in ONE transaction spanning all stores
    (all-or-nothing), merge or replace; appMeta is never imported.
  - Backup service: `createBackup()` with appMeta bookkeeping
    (lastBackupAt + capped backupHistory); `restoreFromArchive()` enforcing
    checksum + schema-version gates and post-restore count verification;
    `getBackupStatus()` powering the configurable boot-time backup reminder.
  - Settings → Backup & data: download backup, guarded restore flow
    (inspect → named-consequences confirm dialog → automatic pre-restore
    safety download → atomic restore → reload), reminder cadence setting.
  - New UI primitives: native `<dialog>`-based ConfirmDialog, file
    download/pick helpers.
  - Release-blocking backup round-trip test suite (6 tests) added to the
    harness: export→wipe→restore fidelity incl. blob bytes and tombstones,
    tamper refusal, schema-gate refusal, device identity preservation.

### Notes
- v1.0 is now feature-complete. Remaining for the exit gate (T-027): the
  live in-browser pass (T-028) — install, offline reload, green test run —
  then tag v1.0.0 and begin v1.1 Plant Manager.
