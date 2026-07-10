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
- [x] **T-017** IndexedDB core: connection manager, migration framework, schema v1 with ALL stores incl. reserved (DATABASE.md §2–3) (2026-07-09)
- [x] **T-018** `Repository` base + envelope stamping (UUID, timestamps, soft delete) per API_DESIGN.md §1 — incl. cursor pagination, streamed exportAll, transactional importBatch (2026-07-09)
- [x] **T-019** LocalStorage settings wrapper (`storage/`) with schema + defaults; Settings page (theme, units, week start) (2026-07-09)
- [x] **T-020** Persistent-storage request + quota monitor + Settings storage display (NFR-3.2) (2026-07-09)
- [x] **T-021** Error framework: `GardenOSError` hierarchy, logger ring buffer, global error capture, Diagnostics view (#/diagnostics: install meta, migration log, flags, store counts, session log) (2026-07-09)
- [x] **T-028** Live in-browser verification (Safari, 2026-07-09): tests/index.html **16/16 green** (database + backup round-trip suites against real IndexedDB); offline reload with the HTTP server killed renders the full app from the service-worker cache (router-set title proves JS executed from cache). Remaining niceties folded into T-027 deferred items.
- [x] **T-022** ExportService.exportFull + archive format v1 + SHA-256 checksum (API_DESIGN §7; FR-9.1) — blobs inline as base64, out-of-line keys preserved (2026-07-09)
- [x] **T-023** ImportService.inspect + importCollections with merge/replace in ONE cross-store transaction (API_DESIGN §7) (2026-07-09)
- [x] **T-024** BackupService: createBackup (appMeta bookkeeping) + guarded restore pipeline (checksum gate, schema gate, safety backup download, atomic replace, post-restore count verification) + Settings UI (FR-9.2, API_DESIGN §8) (2026-07-09)
- [x] **T-025** Backup reminder logic: configurable cadence setting + boot-time sticky toast (FR-9.4) (2026-07-09)
- [x] **T-026** Test harness + database suite (10 tests) + **release-blocking backup round-trip suite** (6 tests: round-trip with blobs/tombstones, tamper refusal, schema-gate refusal, appMeta identity, bookkeeping, merge mode) (2026-07-09) — green run in a real browser required at every release (first run owed via T-028)
- [ ] **T-029** Selective export (FR-9.3): per-collection JSON + CSV (harvests) — deliver alongside first data-bearing module (v1.1+)
- [x] **T-027** v1.0 exit gate → tagged v1.0.0 (2026-07-09). Verified: full test suite green in Safari (16/16 incl. release-blocking round-trip), offline reload with server down renders the app from SW cache, manifest/icons in place. **Deferred with reason:** Lighthouse audit (no Chrome tooling on this machine — run at first opportunity; risk low for a static precached shell) and physical Android install test.

## 🟠 High Priority (v1.1 Plant Manager — starts after v1.0 ships)

- [x] **T-030** Models + validators (DATABASE.md §3): Plant, CareEvent, Note, PestRecord, Treatment, Location, CareProfile (2026-07-09)
- [x] **T-031** Repositories: Plant (status query, derived updates, cascade delete), Event (`[plantId+occurredAt]` timeline w/ type filter, batch delete), Note (recency) — Pest/Treatment/Location/CareProfile use the base Repository via their services; specialized classes exist only where real queries do (2026-07-09)
- [x] **T-032** PlantService + CareEventService incl. `logBulk` with shared batchId + undo with derived-cache recompute (FR-3.2, US-A2) (2026-07-09)
- [x] **T-033** Plant list page: search (incl. botanical), category/status filters, name/newest sort, PlantCard (FR-1.4) — freshness shown as neutral text until care profiles land (T-039) (2026-07-09)
- [x] **T-034** Plant create/edit form: name-only minimum, categories, container, sun, soil + propagation lineage picker (FR-1.6) with lineage section on detail page (2026-07-09)
- [x] **T-035** Plant detail + Timeline (paged, type-filterable, notes shown) + one-tap quick log with Undo + manual/backdated event entry dialog (FR-2.3) (2026-07-09)
- [x] **T-036** Bulk logging flow: select mode on Plants page → action bar (Water/Fertilize/More… with backdating) → one batch, one Undo (US-A2) (2026-07-09)
- [x] **T-037** Notes module: CRUD, tags (normalized), plant links, pin-to-top, live search across title/body/tags (FR-7) (2026-07-09)
- [x] **T-038** Pest & treatment flows: report (with common-pest suggestions) → treat (with "what worked last time" hints) → outcome → resolve; observations and treatments stamp plant timelines; `whatWorkedFor(pestType)` query (FR-10) (2026-07-09)
- [x] **T-039** Locations management page (+ resident counts, delete guard); 16 Karachi-tuned care-profile seed presets with seasonal watering (summer/monsoon/winter) + heat-wave/monsoon notes; `config/climate.karachi.js` (care seasons, v2.5 alert thresholds); location & care-profile pickers on the plant form; effective-care resolution (override → seasonal → base) (2026-07-09)
- [ ] **T-040** Enter full real garden (35+ plants); one-week daily-use validation → v1.1 exit gate → tag

## 🟡 Medium Priority (v1.2 – v1.5)

### v1.2 Image Manager
- [x] **T-050** Image ingest pipeline: camera/file capture → downscale (2048 max) → WebP re-encode with JPEG fallback (Safari) → 320px thumbnail → ONE transaction incl. plant imageCount/cover bookkeeping; capturedAt from file lastModified (full EXIF parse deferred to v2.0 needs) (FR-6.1) (2026-07-09)
- [x] **T-051** Growth photo strip on plant detail + all-photos Gallery page (paged, `[plantId+capturedAt]` / `capturedAt` desc) + photo viewer (caption edit, cover, confirmed delete); page-scoped object-URL lifecycle revoked on navigation (FR-6.4) (2026-07-09)
- [ ] **T-052** Attach images: plants ✓ + cover image ✓ (auto-first + manual) (2026-07-09) — attach-from-event/note/pest UI pending (record model + service links ready)
- [x] **T-053** Images in backup archive (generic blob round-trip, release-gating test) + per-plant storage accounting with byteSize fallbacks + photo totals in Settings → Storage (FR-6.5) (2026-07-09)
- [ ] **T-054** 200-photo performance validation on mid-range Android → v1.2 exit gate (owner device required)

### v1.3 Kitchen Garden
- [x] **T-060** SowingBatch + Harvest models/services: forward-only stage lifecycle (skips allowed for direct-sown crops) with stageHistory; plant-linked batches stamp stage-change and harvest events onto plant timelines (FR-5.1) (2026-07-09)
- [x] **T-061** Kitchen garden page: sow-this-month suggestions, batch cards with stage chips + day counters, stage advancement dialog, finished-batch toggle; "More" hub page keeps primary nav at five slots (2026-07-09)
- [x] **T-062** Harvest logging (crop inherits from batch; first harvest auto-advances to harvesting) + per-crop/per-unit totals windowed by Karachi growing season (Winter Oct–Feb / Summer Mar–Sep) (FR-5.3) (2026-07-09)
- [x] **T-063** Karachi sowing calendar: 19 seeded crops with months + notes, merged with user-added custom crops (add/remove via dialog, stored in appMeta) (FR-5.4) (2026-07-09)

### v1.4 Dashboard
- [x] **T-070** Widget registry (self-registering specs: id/title/order/wide/render/refreshOn) + dashboard rendering registry order with live per-widget bus refresh and subscription teardown on navigation; Customize dialog (toggle + reorder) persisted via new json-kind setting (FR-8.2) (2026-07-09)
- [x] **T-071** Eight widgets: needs-attention (profile vs. history, one-tap water + Undo), quick actions, garden stats, kitchen batches, recent harvests, recent photos, care charts, platform status. Due-TASKS widget arrives with v1.5 tasks themselves (2026-07-09)
- [x] **T-072** Canvas chart primitives (DPR-crisp bar chart + calendar heatmap, token colors, visually-hidden text alternatives) + AnalyticsService (gardenStats, zero-filled dailyEventCounts, dailyActivity) (2026-07-09)

### v1.5 Task Scheduler
- [x] **T-080** Task model + pure recurrence engine: daily/everyNDays count from completion (care cadence), weekly/monthly/seasonal follow the calendar rolled past now; month-end clamping, seasonal year rollover, endAt termination — all local-calendar math, edge cases tested (FR-4.1) (2026-07-09)
- [x] **T-081** Task inbox (overdue/today/next-7-days/later via `[status+dueAt]`) + month calendar view (weekStart-aware, day drill-down) (FR-4.3) (2026-07-09) — instance editing deferred (delete + recreate covers it; revisit on demand)
- [x] **T-082** Complete-task → auto-log care events (batchId) → spawn next instance, with FULL undo (restores pending, deletes spawned instance, reverts events); skip-occurrence keeps series alive (FR-4.4) (2026-07-09)
- [x] **T-083** NotificationService: capability detection, permission flow in Settings, open-time summary notification (tagged, no push server — honestly scoped), always-on fallback badge on the Tasks nav item (FR-4.5) (2026-07-09)
- [x] **T-084** Care-profile fertilizing suggestions: profile/override cadence without a pending task → one-tap recurring task creation, first due one cadence after the last fertilizing (2026-07-09)
- [ ] **T-085** One-month recurrence soak test in real use → v1.5 exit gate → stabilization pass (owner)

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
