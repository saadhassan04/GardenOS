# GardenOS — Engineering Log

Chronological engineering journal. Append one entry per milestone/sprint. Newest at the bottom.
Format: **Version · Date · Summary · Files/Areas Changed · Architecture Impact · Future Notes**.

---

## Phase 0 — Documentation & Architecture
- **Version:** pre-1.0 · **Date:** 2026-07-09
- **Summary:** Full documentation set + folder structure created and owner-approved: README, PROJECT_REQUIREMENTS, ARCHITECTURE, ROADMAP, DATABASE, FEATURES, API_DESIGN, UI_GUIDELINES, CONTRIBUTING, LICENSE, TODO; ADR-0000/0001/0002.
- **Areas:** Root `.md` docs, `docs/adr/`, directory scaffold.
- **Architecture impact:** Established the 5-layer model, offline-first, zero-dependency constitution.
- **Future notes:** These remain the detailed source of truth beneath the memory system.

## v1.0 Foundation — Increment 1 (PWA shell)
- **Version:** 0.1.0 · **Date:** 2026-07-09
- **Summary:** Installable offline shell: `index.html` (CSP, pre-paint theme), design tokens (dark/light), hash router, event bus, DOM helpers, typed errors, ring-buffer logger, settings, navigation, service worker with consent-based update flow.
- **Areas:** `index.html`, `scripts/`, `styles/`, `hooks/`, `utils/`, `storage/`, `components/`, `pwa/`, `config/`.
- **Architecture impact:** Layers 1, 4, 5 stood up; the no-innerHTML DOM discipline established.
- **Future notes:** jsc parse-check flag corrected in increment 2.

## v1.0 Foundation — Increment 2 (IndexedDB core)
- **Version:** 0.2.0 · **Date:** 2026-07-09
- **Summary:** Connection manager + forward-only migration framework; migration 001 (all 17 stores incl. reserved); `Repository` base (envelope stamping, atomic addMany, tombstone-aware reads, cursor pagination, streamed exportAll, transactional importBatch); Diagnostics view; browser test harness + 10 integration tests.
- **Areas:** `database/`, `models/envelope.js`, `pages/DiagnosticsPage.js`, `tests/`.
- **Architecture impact:** Layer 2 substrate; repository pattern enforced.
- **Future notes:** DATABASE.md amended (indexed booleans as 0|1).

## v1.0 Foundation — Increment 3 (backup/restore) + v1.0.0 release
- **Version:** 0.3.0 → 1.0.0 · **Date:** 2026-07-09
- **Summary:** Archive codec v1 (checksum, base64 blobs), export/import/backup services, guarded restore pipeline (checksum + schema gate + safety backup + count verify), backup reminders, ConfirmDialog + fileTransfer. Release-blocking backup round-trip suite added. Verified 16/16 live in Safari incl. offline reload; **tagged v1.0.0**.
- **Areas:** `services/` (archive/export/import/backup), `components/`, `tests/backup.test.js`.
- **Architecture impact:** Data-safety substrate before any feature data (AD-006).
- **Future notes:** Lighthouse + Android install deferred (no tooling on machine).

## v1.1 Plant Manager (increments 1–3)
- **Version:** 1.1.0-dev · **Date:** 2026-07-09
- **Summary:** Registries (categories, statuses, event types); Plant/CareEvent/Note/Pest/Treatment/Location/CareProfile models; specialized repositories (timeline `[plantId+occurredAt]`, cascade/batch delete); services for plants, care events (single/bulk with batchId undo + derived recompute), notes, pests/treatments ("what worked last time"), locations, care profiles (16 Karachi seed presets). UI: Plants list, plant form, plant detail (quick log, backdated events, lineage), notes, locations, pest section. 33 tests.
- **Areas:** `config/registries.js`, `config/climate.karachi.js`, `models/`, `database/`, `services/`, `pages/`, `components/`, `database/seed/careProfiles.karachi.js`.
- **Architecture impact:** Event-sourced history in full use; effective-care resolution (override→seasonal→base).
- **Future notes:** Deterministic same-millisecond ordering fix (name/title tiebreak).

## v1.2 Image Manager
- **Version:** 1.2.0-dev.1 · **Date:** 2026-07-09
- **Summary:** Ingest pipeline (downscale→WebP w/ JPEG fallback→thumbnail→atomic store + plant count/cover); growth strip + Gallery + PhotoViewer; cover thumbnails on cards; per-plant storage accounting; page-scoped object-URL lifecycle. 38 tests.
- **Areas:** `models/ImageRecord.js`, `database/ImageRepository.js`, `services/imageService.js`, `components/PhotoViewer.js`, `pages/GalleryPage.js`.
- **Architecture impact:** Blob handling within the backup round-trip; images excluded from precache (user data).
- **Future notes:** byteSize fallback added after live 37/38 catch. Attach-from-event/note/pest UI still pending (T-052).

## v1.3 Kitchen Garden
- **Version:** 1.3.0-dev.1 · **Date:** 2026-07-09
- **Summary:** Sowing batches (forward-only stage lifecycle + history), harvest logging (crop inheritance, auto-advance to harvesting), Karachi 19-crop sowing calendar (+ user crops in appMeta), season yield totals; Kitchen page; "More" hub page to keep 5 nav slots. 44 tests.
- **Areas:** `models/SowingBatch.js`, `models/Harvest.js`, `services/kitchenGardenService.js`, `services/sowingCalendarService.js`, `pages/KitchenGardenPage.js`, `pages/MorePage.js`, `database/seed/sowingCalendar.karachi.js`.
- **Architecture impact:** Plant-linked batches stamp plant timelines.
- **Future notes:** —

## v1.4 Garden Dashboard
- **Version:** 1.4.0-dev.1 · **Date:** 2026-07-09
- **Summary:** Self-registering widget registry + customizable dashboard (toggle/reorder persisted as json setting); 8 widgets (needs-attention, quick actions, stats, batches, recent harvests, recent photos, care charts, status); canvas chart primitives (bar + calendar heatmap, no libraries); AnalyticsService. 48 tests.
- **Areas:** `widgets/`, `components/charts.js`, `services/analyticsService.js`, `pages/DashboardPage.js`, `storage/settings.js` (json-kind).
- **Architecture impact:** AD-007 widget pattern; live bus-driven refresh with teardown.
- **Future notes:** Due-tasks widget deferred to v1.5 (needed tasks).

## v1.5 Task Scheduler (offline core complete)
- **Version:** 1.5.0-dev.1 · **Date:** 2026-07-09
- **Summary:** Pure recurrence engine (AD-008); Tasks page (inbox + month calendar); complete→auto-log→spawn with full undo; skip; NotificationService (capability detection, open-time summary, due-count badge); care-profile fertilizing suggestions; due-tasks widget; Gallery moved under More. 54 tests. **v1.x offline core feature-complete.**
- **Areas:** `models/Task.js`, `services/recurrence.js`, `services/taskSchedulerService.js`, `services/notificationService.js`, `pages/TasksPage.js`, `widgets/dueTasksWidget.js`, `components/Navigation.js` (badge).
- **Architecture impact:** Task completion links to care events (batchId) for undo.
- **Future notes:** Noon-anchored test fixture flake fixed (exact elapsed offsets).

## Post-v1.5 — Owner setup, seeding & data corrections
- **Version:** 1.5.0-dev.2 → dev.5 · **Date:** 2026-07-09 → 2026-07-12
- **Summary:** (dev.1→2) Owner starter-garden auto-seeding + auto persistent-storage request. (dev.3) Care-profile management UI (list/form, delete guard, source-preserving edits) + per-plant watering override field. (dev.4) Six new plant categories (foliage, succulents, shrubs, climbers, bonsai, bulbs). (dev.5) One-time guarded category recategorization of seeded plants (AD-009). Local Mac deployment: `deploy-local.sh` + LaunchAgent serving `~/GardenOS` on :8080. 58 tests.
- **Areas:** `services/gardenSeedService.js`, `database/seed/ownerGarden.karachi.js`, `pages/CareProfilesPage.js`, `pages/CareProfileFormPage.js`, `config/registries.js`, `scripts/app.js`, `deploy-local.sh`.
- **Architecture impact:** AD-009 established. Name-keyed recategorization only catches un-renamed seeded plants.
- **Future notes:** Setting `setFlag()` keyed-argument bug caught live at 57/58.

## Photo audit (human-in-the-loop vision) — findings, not yet applied
- **Version:** 1.5.0-dev.5 · **Date:** 2026-07-12
- **Summary:** Decoded the owner's backup (`gardenos-backup-2026-07-11-22-07.json`), reviewed all 32 plant photos with Claude vision against records (54 active plants). IDs overwhelmingly correct. Findings: (1) category corrections for most ornamentals/foliage/climbers/succulents (most renamed, so today's auto-recategorization missed them); (2) ID flags — "Bamboo Palm" likely a Dracaena cane, "Copperleaf" low-confidence, "Rose Pink" missing botanical (*Rosa indica*); (3) health notes — jasmine heat-stress, bamboo-palm cane lesions, soil algae. **No data changed** — awaiting owner confirmation (scope + flags).
- **Areas:** analysis only (scratchpad decode); proposed change set recorded here + in HANDOFF.
- **Architecture impact:** Manual precursor to v2.0 AI Vision; will apply via AD-009 guarded correction once confirmed.
- **Future notes:** See HANDOFF → Paused/awaiting owner input; recommended Sprint S-14.

## Sprint S-13 — Daily tracking usability
- **Version:** 1.5.0-dev.6 · **Date:** 2026-07-12 · **Commit:** `758f2cb`
- **Summary:** (1) Location filter on the Plants page — `listPlants` gained a `locationId` filter; a Location select (async from `listLocations`) joins the filter bar and combines with category/status/search. (2) Per-plant progress notes & milestones — new `flowering`/`fruiting`/`new-growth` event types (flower/fruit/sprout icons); the plant-detail action relabeled "Add note / update…", defaulting to a dated `observation`; entries render on the plant timeline. 60 tests green live.
- **Areas:** `services/plantService.js`, `pages/PlantsPage.js`, `config/registries.js`, `assets/icons/sprite.svg`, `pages/PlantDetailPage.js`, `tests/plants.test.js`.
- **Architecture impact:** None new — additive via registry + existing event/timeline pipeline. Milestones carry no `derivedField` (don't touch care caches); `flowering`/`fruiting` (quickLog) also appear as schedulable task types.
- **Future notes:** Progress "current phase" derived state deliberately not added (timeline suffices) — revisit only if a "what's flowering now" dashboard view is wanted.

## Project Memory System
- **Version:** 1.5.0-dev.5 · **Date:** 2026-07-12
- **Summary:** Created `docs/project-memory/` (PROJECT_STATE, HANDOFF, CLAUDE, ARCHITECTURE_DECISIONS, ENGINEERING_LOG, NEXT_SPRINT, KNOWN_TECH_DEBT, GARDEN_AI_ROADMAP, PRODUCT_VISION) + root `CLAUDE.md` pointer. GardenOS is now self-documenting (AD-010).
- **Areas:** `docs/project-memory/`, root `CLAUDE.md`.
- **Architecture impact:** Development no longer depends on conversation context.
- **Future notes:** Update these after every sprint (see CLAUDE.md → Future Development Rules).
