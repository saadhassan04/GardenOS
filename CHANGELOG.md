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
- Deployed to GitHub Pages (https://saadhassan04.github.io/GardenOS/) so the phone can install the PWA.
- **v1.5 Task Scheduler** (app 1.5.0-dev.1) — the offline core is now
  feature-complete (ROADMAP.md v1.x):
  - Pure recurrence engine (FR-4.1): daily/every-N-days count from the
    completion date (care cadence — a late watering doesn't spawn an
    already-overdue next); weekly/monthly/seasonal follow the calendar,
    rolled forward past now; month-end clamping (Jan 31 → Feb 28),
    seasonal year rollover, series end dates. Local-calendar math
    throughout.
  - Tasks page in primary navigation: inbox (overdue / today / next 7
    days / later), weekStart-aware month calendar with day drill-down,
    task creation dialog (types, plant link, repeat patterns).
  - Complete → auto-log → spawn (FR-4.4): completing a care-type task logs
    the matching events for its plants and spawns the next recurring
    instance — with full Undo (pending restored, spawned instance removed,
    events reverted). Skip keeps the series alive.
  - Notifications (FR-4.5): capability-detected permission flow in
    Settings, tagged open-time summary notification (no push server —
    honestly scoped), and the always-available due-count badge on the
    Tasks nav item.
  - Care-profile suggestions (T-084): fertilizing cadences without a
    pending task surface as one-tap recurring-task creation.
  - Due-tasks dashboard widget (the FR-8.1 widget that waited for tasks);
    Gallery moved under More to keep five nav slots.
  - 6 new integration tests (54 total) — all green live in Safari.

### Fixed
- Test-suite time-of-day flake: day-count assertions anchored at noon
  passed only when the suite ran after noon. Fixtures now use exact
  elapsed offsets. Caught live at 53/54.
- **v1.4 Garden Dashboard** (app 1.4.0-dev.1):
  - Widget registry (FR-8.2): widgets self-register with id/title/order/
    render/refreshOn; the dashboard renders whatever is registered and
    re-renders individual widgets live on their declared bus topics
    (subscriptions torn down on navigation). Customize dialog toggles and
    reorders widgets; layout persists via a new json-kind setting.
  - Eight widgets: needs-attention (care profile vs. actual history,
    one-tap watering with Undo), quick actions, garden stats, kitchen
    batches, recent harvests, recent photos strip, care activity charts,
    and platform status (relocated from the old dashboard).
  - Canvas chart primitives (T-072, no libraries): DPR-crisp bar chart and
    calendar heatmap, colored from design tokens, each with a
    visually-hidden text alternative for screen readers.
  - AnalyticsService: gardenStats headline numbers, zero-filled daily
    event-count series (watering chart), and all-event daily activity
    (12-week heatmap).
  - Settings storage now supports json-kind values alongside enums.
  - 4 new integration tests (48 total) — all green live in Safari.
- **v1.3 Kitchen Garden** (app 1.3.0-dev.1):
  - Sowing batches (FR-5.1): validated model, forward-only stage lifecycle
    (sown → … → finished, skips allowed for direct-sown crops) with
    on-record stage history; plant-linked batches stamp stage-change and
    harvest events onto plant timelines.
  - Harvest logging (FR-5.3): crop inherited from the batch, first harvest
    auto-advances a batch to "harvesting"; yield totals grouped by crop and
    unit, windowed by Karachi growing season (Winter Oct–Feb / Summer
    Mar–Sep).
  - Karachi sowing calendar (FR-5.4): 19 seeded crops with sowing months
    and notes, merged with user-added crops (add/remove, stored in appMeta);
    crop-name suggestions in the sowing form.
  - Kitchen garden page in primary navigation: sow-this-month chips, batch
    cards with day counters, stage/harvest dialogs, season yield summary.
  - "More" hub page (Notes, Locations, Settings, Diagnostics) keeps the
    mobile bottom bar at the five slots UI_GUIDELINES.md specifies.
  - 6 new integration tests (44 total) — all green live in Safari.
- **v1.2 Image Manager** (app 1.2.0-dev.1):
  - Ingest pipeline (FR-6.1): decode → downscale (2048px max edge) → WebP
    re-encode with automatic JPEG fallback where the browser can't encode
    WebP (Safari) → 320px thumbnail → one atomic transaction that also
    maintains the plant's photo count and auto-assigns the first photo as
    cover. capturedAt comes from the file's lastModified (camera shot time).
  - Growth photo strip on the plant detail page; all-photos Gallery page
    (paged, newest-first) in primary navigation; photo viewer dialog with
    caption editing, cover selection, and confirmed deletion.
  - Plant cards now show cover thumbnails; camera capture opens directly on
    mobile (`capture="environment"`).
  - Object-URL lifecycle: page-scoped URLs revoked wholesale on navigation.
  - Per-plant photo storage accounting + photo totals in Settings → Storage
    (FR-6.5); images ride the existing checksummed backup round-trip.
  - 5 new integration tests (38 total) exercising the real canvas encode
    path — all green live in Safari.

### Fixed
- Storage accounting no longer produces NaN totals for image records that
  lack byteSize (hand-imported or pre-v1.2 data): byte counts fall back to
  the blob's actual size. Caught live at 37/38.
- **v1.1 Plant Manager, increment 3** (app 1.1.0-dev.3):
  - Pest & treatment flows (FR-10): report with common-Karachi-pest
    suggestions, treat with "what worked last time" hints drawn from
    recorded outcomes, outcome tracking, resolve — all stamping plant
    timelines as first-class events; `whatWorkedFor(pestType)` query.
  - Garden locations: management page with resident plant counts and a
    delete guard (occupied locations refuse deletion); location picker on
    the plant form; location shown on plant detail.
  - Care profiles: 16 Karachi-tuned seed presets (plumeria, bougainvillea,
    rose, motia, tulsi, ferns, palms, snake plant, pothos, rubber plant,
    dieffenbachia, dracaena, curry leaf, citrus, mint, winter vegetables)
    with seasonal watering intervals and heat-wave/monsoon guidance;
    idempotent first-run seeding; profile picker on the plant form;
    effective-care resolution: plant override → seasonal → base.
  - `config/climate.karachi.js`: care seasons (summer/monsoon/winter by
    month) and the v2.5 weather-alert thresholds.
  - Generic FormDialog component powering location/pest/treatment forms.
  - 5 new integration tests (33 total), all green live in Safari.

### Fixed
- Deterministic list ordering for records created in the same millisecond
  (bulk imports): plant "newest" sort and note recency now tiebreak by
  name/title. Surfaced by a live test flake (passed twice by UUID luck).
- **v1.1 Plant Manager, increment 2** (app 1.1.0-dev.2):
  - Bulk care logging (US-A2): Select mode on the Plants page with
    accessible toggle cards, floating action bar (Water / Fertilize /
    More… with type + backdate dialog) — one transaction, one batch,
    one Undo.
  - Manual/backdated event entry dialog (FR-2.3) on the plant detail page;
    timeline items now display event notes.
  - Propagation lineage (FR-1.6): parent picker in the plant form,
    `getLineage()` walking ancestors and cuttings, lineage section on the
    detail page.
  - Garden Notes module (FR-7): validated model (normalized tags, 0/1
    pinned), repository, service with pinned-first recency ordering and
    live search across title/body/tags, Notes list + create/edit pages,
    plant linking, Notes in primary navigation.
  - Test harness hardening: runner reports progress and module-graph
    failures through the page title (readable by headless verification);
    `tests/serve.py` no-cache dev server after live debugging showed
    Safari's heuristic HTTP cache serving stale ES modules alongside
    fresh ones ("Importing binding name … not found").
  - 5 new integration tests (28 total) — all green live in Safari.
- **v1.1 Plant Manager, increment 1** (app 1.1.0-dev.1):
  - Domain registries (`config/registries.js`): plant categories, statuses,
    sun exposures, container types, and 13 care event types with icon and
    derived-field mappings — new vocabulary = one registry entry (FR-3.3).
  - Plant and CareEvent models with full validation (only `name` required;
    future-dated events rejected; registry-checked enums).
  - PlantRepository (status queries, derived-cache updates, permanent-delete
    cascade over events) and EventRepository (timeline via
    `[plantId+occurredAt]` descending with type filter, batch deletion).
  - PlantService (create/update with whole-record re-validation, status
    transitions, soft + cascading permanent delete, shaped list) and
    CareEventService (single/bulk logging — every log carries a batchId for
    uniform Undo; backdated events never regress "last done" caches; undo
    recomputes derived caches from surviving history).
  - Plants page (search, category/status filters, sort, empty states),
    plant create/edit form, plant detail page with profile summary,
    one-tap quick log + Undo toast, and the paginated, type-filterable
    timeline. New icons: home, plus, pot, scissors, bug, spray.
  - 7 new integration tests (23 total) — all green live in Safari.

## [1.0.0] - 2026-07-09 — Foundation

Release gate evidence: 16/16 tests green in Safari against real IndexedDB
(including the release-blocking backup round-trip); offline reload verified
with the HTTP server terminated. Lighthouse audit and physical Android
install deferred with reason (no tooling on this machine) — see TODO T-027.

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

