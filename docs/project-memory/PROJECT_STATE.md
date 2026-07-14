# GardenOS — Project State

**This document always describes GardenOS exactly as it currently exists.**
Update it after every completed sprint.

- **Snapshot date:** 2026-07-12
- **Current version:** `1.5.0-dev.5` (last released tag: `v1.0.0`)
- **Last commit:** `87a062a` — feat: recategorize seeded plants into the richer taxonomy
- **Branch:** `main`
- **Uncommitted in-flight work:** location filter (`pages/PlantsPage.js`, `services/plantService.js`) — see [HANDOFF.md](HANDOFF.md)

---

## Current Version

`1.5.0-dev.5`. The v1.x offline core is **feature-complete and code-complete**; v1.0.0 is the only formally tagged release. v1.1–v1.5 are built and green but await owner real-world exit gates before tagging (see [HANDOFF.md](HANDOFF.md) → Known Technical Debt / exit gates).

## Completed Modules

| Module | Version | Status |
|---|---|---|
| Foundation (PWA shell, DB core, backup/restore, settings, diagnostics) | v1.0 | ✅ Released (tagged v1.0.0) |
| Plant Manager (CRUD, care events, timeline, notes, pests/treatments, locations, care profiles) | v1.1 | ✅ Code-complete |
| Image Manager (ingest pipeline, thumbnails, galleries, viewer, covers) | v1.2 | ✅ Code-complete |
| Kitchen Garden (sowing lifecycle, harvests, Karachi sowing calendar) | v1.3 | ✅ Code-complete |
| Garden Dashboard (widget registry, needs-attention, canvas charts) | v1.4 | ✅ Code-complete |
| Task Scheduler (recurrence engine, inbox, calendar, notifications) | v1.5 | ✅ Code-complete |

**Post-v1.5 additions (owner-driven, on `main`):** care-profile management UI + per-plant watering override; six new plant categories (foliage, succulents, shrubs, climbers, bonsai, bulbs); automatic starter-garden seeding of the owner's collection; one-time guarded category recategorization.

## Current Architecture

Five-layer, strictly downward-dependent (see [CLAUDE.md](CLAUDE.md) and ARCHITECTURE.md at repo root):

```
L5 UI          pages/ · components/ · widgets/ · styles/
L4 Application modules/ · hooks/ (router, event bus, store)
L3 Business    services/ (plant, careEvent, image, kitchenGarden, tasks, analytics, backup, notification, careProfile, locations…)
L2 Data        models/ (validators) · database/ (repositories, migrations, seed)
L1 Platform    pwa/ · storage/ · config/ · utils/
```

Key patterns in force: **repository pattern** (only `database/` touches IndexedDB), **event-sourced care history** (immutable `events` + recomputable derived caches), **internal event bus** (namespaced topics; modules never import each other), **hash router**, **self-registering widget registry**, **sync-ready record envelope** on every record (UUID, timestamps, soft-delete tombstone, record `schemaVersion`).

## Current Database Version

**IndexedDB schema version 1.** Database name `gardenos`. 17 object stores, including reserved future stores (`analyses`, `weatherCache`, `sensorReadings`, `oplog`) created empty at v1 so future eras need data seeding, not structural migration. Forward-only migration framework in `database/migrations/` (one migration registered: `001_initial_schema`). Indexed boolean-like fields stored as `0|1`.

## Current Technology Stack

HTML5 · CSS3 (custom properties, Grid, Flexbox) · **vanilla JavaScript ES6 modules** · IndexedDB · LocalStorage · Service Worker · Web App Manifest. **Zero runtime dependencies. No build step.** Dev-only: `tests/serve.py` (no-cache static server), macOS JavaScriptCore for parse checks (no Node.js on the owner's machine). Everything free; no accounts, no paid services.

## Current UI Theme

"Calm greenhouse." Dark theme default (light + auto available), applied pre-paint (zero flash). All visual values from design tokens in `styles/tokens.css`. Mobile-first: 5-slot bottom nav (Dashboard · Plants · Tasks · Kitchen · More), sidebar on desktop ≥768px. WCAG 2.1 AA target. Canvas charts, no chart libraries.

## Current Garden Knowledge

16 Karachi-tuned care profiles (seasonal summer/monsoon/winter watering + heat-wave/monsoon notes) seeded on first run. 19-crop Karachi sowing calendar. Karachi climate profile (`config/climate.karachi.js`: care seasons + v2.5 weather-alert thresholds + coordinates). Owner's real collection seeded automatically (~33 starter plants; owner has since grown it to 50+). Plant taxonomy: 14 categories.

## Current AI Readiness

**No AI implemented yet** (correctly — it's the v2.0+ era). The ground is prepared: event-sourced structured history is machine-readable training/context data; `analyses` store reserved; service-interface contracts for `IPlantIdentifier`, `IDiseaseDetector`, `IGardenAdvisor`, `IWeatherProvider` documented in API_DESIGN.md; images retain capture dates. A manual human-in-the-loop photo review (Claude's vision) has been used once to audit plant IDs/categories — see [ENGINEERING_LOG.md](ENGINEERING_LOG.md). Full plan: [GARDEN_AI_ROADMAP.md](GARDEN_AI_ROADMAP.md).

## Current Project Health

**Healthy.** 58 integration tests, all green in Safari against real IndexedDB (release-blocking backup round-trip included). Every increment verified live before commit. Zero dependencies to rot. Clean git history with descriptive commits. Documentation (root `.md` set + this memory system) current. Low technical debt (see [KNOWN_TECH_DEBT.md](KNOWN_TECH_DEBT.md)).

## Current Offline Features

100% of features work with no network. Service worker precaches the full app shell (cache versioned per release); cache-first for same-origin GETs; navigations fall back to the shell offline. Verified: reload with the server killed renders the full app. Persistent storage requested automatically once data exists. Backup/restore is fully local (single checksummed JSON file, images included).

## Current PWA Status

Installable on Android, desktop, and iOS. Manifest + full icon set (192/512/maskable). Consent-based update flow ("Update available" toast → user accepts → `skipWaiting` → reload; never silent). Root `sw.js` shim loads `pwa/service-worker.js`. Installed on the owner's Mac via a LaunchAgent serving `~/GardenOS` at `http://127.0.0.1:8080` (see `deploy-local.sh`, README §Personal install on macOS).
