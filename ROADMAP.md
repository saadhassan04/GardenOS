# GardenOS — Product Roadmap

**Document status:** Living document · 2026-07-09
**Philosophy:** Ship small, complete, verified increments. Every version is fully usable, fully offline, fully backed-up. No version ships with placeholder features.

Milestone dates are estimates assuming part-time development; scope, not dates, is the commitment. Each version has an **exit gate** — the release does not ship until every gate item passes.

---

## Phase 0 — Documentation & Architecture *(current — July 2026)*

All planning documents written and approved: requirements, architecture, database schema, API contracts, UI guidelines, roadmap. **Gate:** owner approval of this documentation set. → Then implementation begins.

---

## v1.0 — Foundation *(target: August 2026)*

The skeleton everything else hangs on. Small surface, production quality.

**Scope**
- PWA shell: `index.html`, manifest, icons, service worker with full offline precache, install prompt, update flow.
- IndexedDB core: connection manager, migration framework (v1 schema from DATABASE.md), repository base class.
- App chrome: hash router, event bus, navigation (bottom nav mobile / sidebar desktop), dark/light themes from design tokens.
- Settings module: theme, units, start-of-week, storage usage display, diagnostics view.
- **Backup / Restore / Export / Import** — full archive round-trip with checksum validation (data safety ships *first*, not last).
- Test harness running unit + integration suites.

**Exit gate:** installable on Android + desktop; works offline after first load; Lighthouse PWA ≥ 90; backup→wipe→restore round-trip verified; zero console errors.

---

## v1.1 — Plant Manager *(target: September 2026)*

The heart of the product.

**Scope**
- Plant CRUD with categories, locations, containers, care profiles, propagation lineage, soft archive.
- Care event logging: watering, fertilizing, repotting, pruning, deadheading, pest observation, treatment, general note — single & bulk.
- Plant Timeline: unified chronological history per plant, filterable, paginated.
- Plant list: search, filters, sort, "last watered" indicators.
- Garden Notes module (linked notes, tags, search).
- Seed data: care presets for the current collection (plumerias, bougainvillea, palms, snake plants, tulsi, etc.).

**Exit gate:** entire current garden (35+ plants) entered and managed daily for one week without friction; bulk watering ≤ 3 taps; timeline correct across 100+ events.

---

## v1.2 — Image Manager *(target: October 2026)*

**Scope**
- Camera/file capture → Blob storage with automatic thumbnail generation.
- Attach images to plants, events, notes, pest records.
- Per-plant growth gallery (chronological strip) + all-photos gallery.
- Storage quota monitoring; images included in backup/restore.

**Exit gate:** 200-photo library stays smooth on mid-range Android; backup archive with images restores perfectly; capture-to-saved < 2 s.

---

## v1.3 — Kitchen Garden *(target: November 2026)*

**Scope**
- Sowing batches with full lifecycle stages (seed → harvest → finished).
- Harvest logging with quantities/units; per-crop and per-season aggregation.
- Karachi sowing calendar (seeded data, user-editable) — timed for the Oct–Feb winter growing season.
- Kitchen Garden dashboard section: active crops, days-since-sowing, expected windows.

**Exit gate:** current winter-vegetable cycle (tomatoes, spinach, broccoli, peas…) tracked end-to-end; harvest totals verified.

---

## v1.4 — Garden Dashboard *(target: December 2026)*

**Scope**
- Widget registry + dashboard: due/overdue tasks, garden stats, recent photos, recent harvests, quick-log shortcuts, "needs attention" (derived from care profiles vs. history).
- Widget toggle/reorder persistence.
- First analytics: watering frequency charts, harvest totals (canvas-based, no chart library).

**Exit gate:** dashboard is the daily entry screen; renders < 500 ms warm; widgets update live via event bus.

---

## v1.5 — Task Scheduler *(target: February 2027)*

**Scope**
- One-off + recurring tasks (daily / every-N-days / weekly / monthly / seasonal), plant-linked or general.
- Care calendar view (month/week); overdue escalation.
- Complete-task → auto-log care event flow.
- Notifications where platform allows; graceful fallback badge/inbox otherwise.
- Care-profile-driven task suggestions ("Rose fertilizing due every 30 days — create recurring task?").

**Exit gate:** one month of real use with zero missed recurring generations; DST/timezone-safe recurrence proven by tests.

**🏁 v1.5 = feature-complete offline core. Stabilization pass, then the intelligence era begins.**

---

## v2.0 — AI Vision *(target: mid 2027)*

- On-device plant identification + disease detection from photos (TF.js models, SW-cached; offline after model download).
- `analyses` records attached to images; confidence surfaced honestly; user confirms/corrects (corrections stored — future training signal).
- **Gate:** useful results on real garden photos (plumeria rust, mealybugs, fungal leaf spot are the acid tests); zero regressions to offline core.

## v2.5 — Weather Intelligence *(target: late 2027)*

- Open-Meteo integration (free, keyless) for Karachi; cached offline with staleness indicators.
- Weather dashboard widget; heat-wave & monsoon alerts; rain-aware watering suppression suggestions on tasks.
- **Gate:** app remains 100% functional with network off; advice traceably correct against forecast data.

## v3.0 — Garden AI *(target: 2028)*

- Plant Doctor: symptom Q&A grounded in the plant's actual history + local knowledge base.
- Fertilizer Advisor & Watering Prediction from event history + weather + climate profile.
- AI Chat Assistant over the garden's own data; Garden Knowledge Base (local, curated, Karachi-aware).
- **Gate:** advice quality validated against horticultural references; every recommendation explains its reasoning.

## v4.0 — Cloud Synchronization *(target: 2029)*

- Optional, opt-in, end-to-end-encrypted multi-device sync via `SyncedRepository` decorator + oplog (see ARCHITECTURE.md §10). Free-tier/user-owned storage only.
- **Gate:** two-device concurrent-edit torture test with zero data loss; offline-first behavior unchanged when sync disabled.

## v5.0 — IoT Sensors *(target: 2030)*

- Soil-moisture / temperature / light ingestion via Web Bluetooth / Web Serial / local HTTP into `sensorReadings`.
- Sensor-driven watering automation suggestions; sensor charts on plant pages.
- **Gate:** one real sensor deployed on a real plant feeding real decisions.

## v6.0 — Garden Digital Twin *(target: 2031+)*

- Spatial model of the garden (areas → positions → geometry); visual garden map; sun-path modeling for Karachi latitude.
- Simulation: placement what-ifs, seasonal planning, growth projection from years of accumulated data.
- **Gate:** the twin answers a real planning question better than intuition does.

---

## Release Discipline (all versions)

1. Update CHANGELOG.md (Keep a Changelog) and bump the schema version if the DB changed (with tested migration).
2. Backup/restore round-trip test passes — **release-blocking, every release**.
3. Lighthouse PWA ≥ 90; no console errors; WCAG AA spot-check.
4. Docs updated: FEATURES.md status flips, TODO.md groomed, ADRs for any architecture change.
5. Tag the release; export a fresh backup before first use of a new schema version.
