# GardenOS — Engineering Task Board

**Document status:** Living document · 2026-07-09
**Grooming rule:** re-prioritized at every release (CONTRIBUTING.md §6). Task IDs are stable; requirement references point to PROJECT_REQUIREMENTS.md.

---

## 🔴 High Priority (blocks v1.0 Foundation)

### Phase 0 — Approval gate
- [x] **T-001** Owner review & approval of the full documentation set — approved 2026-07-09
- [x] **T-002** Initialize git repository; commit documentation baseline; add `.gitignore` (2026-07-09)

### v1.0 — Platform core
- [x] **T-010** App shell: `index.html` (semantic landmarks, CSP meta, theme pre-paint script) + `scripts/app.js` bootstrap sequence per ARCHITECTURE.md §5.4 (2026-07-09)
- [x] **T-011** Design tokens → `styles/tokens.css` (both themes, all tokens from UI_GUIDELINES.md §2–4) + `base.css`, `layout.css`, `components.css` (2026-07-09)
- [x] **T-012** Hash router (`hooks/router.js`): route registry, params, deep links, back-button correctness (NFR-8) (2026-07-09)
- [x] **T-013** Event bus (`hooks/bus.js`): topics per API_DESIGN.md §11, typed payloads, unsubscribe hygiene (2026-07-09)
- [x] **T-014** Navigation chrome: bottom nav (mobile) / sidebar (desktop), responsive per UI_GUIDELINES.md §5–6 (2026-07-09)
- [x] **T-015** PWA: `manifest.json`, full icon set (192/512/maskable), install via browser prompt (FR-9, NFR-1) (2026-07-09)
- [x] **T-016** Service worker: app-shell precache, cache-first strategy, versioned caches, update-available prompt (NFR-1.2, ARCH §13) — root `sw.js` shim + `pwa/service-worker.js` (2026-07-09)
- [ ] **T-017** IndexedDB core: connection manager, migration framework, schema v1 with ALL stores incl. reserved (DATABASE.md §2–3)
- [ ] **T-018** `IRepository` base + envelope stamping (UUID, timestamps, soft delete) per API_DESIGN.md §1
- [x] **T-019** LocalStorage settings wrapper (`storage/`) with schema + defaults; Settings page (theme, units, week start) (2026-07-09)
- [x] **T-020** Persistent-storage request + quota monitor + Settings storage display (NFR-3.2) (2026-07-09)
- [ ] **T-021** Error framework: `GardenOSError` hierarchy ✓, logger ring buffer ✓, global error capture ✓ (2026-07-09) — Diagnostics view still pending
- [ ] **T-028** In-browser verification pass of increment 1 (install, offline reload, theme switch, both viewports) — jsc parse checks, precache/import audits, and HTTP 200 sweep done 2026-07-09; live browser check pending (no Node/preview tooling on this machine)
- [ ] **T-022** ExportService.exportFull + archive format + checksum (API_DESIGN §7; FR-9.1)
- [ ] **T-023** ImportService.inspect + importArchive with merge/replace (FR-9.3, API_DESIGN §7)
- [ ] **T-024** BackupService: create/restore pipeline with pre-restore snapshot + verify (FR-9.2, API_DESIGN §8)
- [ ] **T-025** Backup reminder logic (FR-9.4)
- [ ] **T-026** Test harness (browser runner); unit + integration suites; **backup round-trip test** (release-blocking)
- [ ] **T-027** v1.0 exit gate run: offline install test, Lighthouse ≥ 90, round-trip verified → tag v1.0.0

## 🟠 High Priority (v1.1 Plant Manager — starts after v1.0 ships)

- [ ] **T-030** Models + validators: Plant, CareEvent, Note, PestRecord, Treatment, Location, CareProfile (DATABASE.md §3)
- [ ] **T-031** Repositories: Plant, Event (with `[plantId+occurredAt]` timeline query), Note, Pest, Treatment, Location, CareProfile
- [ ] **T-032** PlantService + CareEventService incl. `logBulk` with batchId + undo (FR-3.2, US-A2)
- [ ] **T-033** Plant list page: search/filter/sort, PlantCard with freshness dot (FR-1.4, UI §7)
- [ ] **T-034** Plant create/edit form (name-only minimum, FR-1.2/1.3); propagation lineage picker (FR-1.6)
- [ ] **T-035** Plant detail + Timeline (paged, filterable, 3-tap quick log, backdating) (FR-2)
- [ ] **T-036** Bulk logging flow (multi-select → action) (US-A2)
- [ ] **T-037** Notes module: CRUD, tags, plant links, client-side search (FR-7)
- [ ] **T-038** Pest & treatment flows incl. "what worked for X" query (FR-10)
- [ ] **T-039** Locations management; seed Karachi care-profile presets + event-type/category registries in `config/`
- [ ] **T-040** Enter full real garden (35+ plants); one-week daily-use validation → v1.1 exit gate → tag

## 🟡 Medium Priority (v1.2 – v1.5)

### v1.2 Image Manager
- [ ] **T-050** Image ingest pipeline: capture/upload → webp re-encode → thumbnail → transactional store (FR-6.1, API §5)
- [ ] **T-051** Growth gallery + all-photos gallery (paged, `[plantId+capturedAt]`) (FR-6.4)
- [ ] **T-052** Attach images to events/notes/pests; cover image (FR-6.2)
- [ ] **T-053** Images in backup archive; storage breakdown per plant (FR-6.5)
- [ ] **T-054** 200-photo performance validation on mid-range Android → exit gate

### v1.3 Kitchen Garden
- [ ] **T-060** SowingBatch + Harvest models/repos/services; stage-change events (FR-5.1)
- [ ] **T-061** Kitchen garden pages: batches, stage advancement, day counters
- [ ] **T-062** Harvest logging + per-crop/per-season totals (FR-5.3)
- [ ] **T-063** Karachi sowing calendar seed data (researched & horticulturally reviewed) + editor (FR-5.4)

### v1.4 Dashboard
- [ ] **T-070** Widget registry + dashboard page with toggle/reorder persistence (FR-8.2)
- [ ] **T-071** Widgets: due tasks, stats, recent photos, recent harvests, needs-attention, quick-log
- [ ] **T-072** Canvas chart primitives (bar/line/heatmap) + first analytics (AnalyticsService)

### v1.5 Task Scheduler
- [ ] **T-080** Task model + recurrence engine (daily/N-days/weekly/monthly/seasonal) with timezone/DST tests (FR-4.1)
- [ ] **T-081** Task inbox (overdue/today/upcoming) + calendar views (FR-4.3)
- [ ] **T-082** Complete-task → auto-log care event flow (FR-4.4)
- [ ] **T-083** Notifications with capability detection + fallback inbox (FR-4.5, API §6)
- [ ] **T-084** Care-profile-driven task suggestions
- [ ] **T-085** One-month recurrence soak test → v1.5 exit gate → stabilization pass

## 🟢 Low Priority (v2.0+ — do not start; keep contracts warm)

- [ ] **T-100** (v2.0) Evaluate on-device TF.js models for plant ID / disease detection; ADR for model choice
- [ ] **T-101** (v2.0) AIVisionService + `analyses` flow + confirm/correct UI
- [ ] **T-110** (v2.5) OpenMeteoProvider + weatherCache + alerts from `climate.karachi.js` thresholds
- [ ] **T-111** (v2.5) Weather widget + rain-aware watering suggestions
- [ ] **T-120** (v3.0) Knowledge base corpus (Karachi-aware); Plant Doctor grounding pipeline
- [ ] **T-130** (v4.0) Sync ADR: transport selection (free-tier options), E2E crypto design, oplog engine
- [ ] **T-140** (v5.0) Sensor adapter spike (Web Bluetooth soil-moisture PoC)
- [ ] **T-150** (v6.0) Garden map spatial model design on top of `location` structure

### Backlog / ideas (unscheduled — promote via ADR)
- [ ] **T-900** QR plant tags · **T-901** time-lapse from growth gallery · **T-902** companion-planting advisor · **T-903** Urdu localization pass (Intl groundwork exists)

## ✅ Completed

- [x] **T-000** Project initialization: full directory structure + complete documentation set (2026-07-09)
