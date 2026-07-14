# GardenOS — Next Sprint

**This file always contains ONLY the next (current) sprint.** Replace its contents after the sprint completes.

---

## Sprint S-13 — Daily Tracking Usability

**Status:** In progress (paused to build the Project Memory System).
**Target version:** `1.5.0-dev.6`.

### Objectives
Make day-to-day progress tracking effortless: filter plants by location, and log dated progress notes / milestones (flowering, fruiting…) directly from a plant.

### Scope
1. **Location filter on the Plants page.** ⏳ *In-flight (uncommitted).*
   - `services/plantService.js` — `listPlants` accepts `locationId` and filters. ✅ done in working tree.
   - `pages/PlantsPage.js` — add a Location `<select>` in the filter bar, populated async from `listLocations()`; empty-state copy accounts for the location filter. ✅ done in working tree.
   - Remaining: version + cache bump, add a location-filter test, verify live, commit.
2. **Per-plant progress notes & milestone events.** 🔲 Not started.
   - `config/registries.js` — add event types `flowering`, `fruiting`, `new-growth` (milestones; `flowering`/`fruiting` `quickLog: true`, no `derivedField`).
   - `assets/icons/sprite.svg` — add `flower`, `fruit`, `sprout` icons.
   - `pages/PlantDetailPage.js` — relabel the "Log event…" action to an obvious **"Add note / update…"** defaulting to `observation`; the new milestone types auto-appear as quick-log buttons. Ensure event notes render on the timeline (already do).
   - Confirm the event dialog's date field allows the correct range (today + backdating) for notes.

### Deliverables
- Location filter working and tested; progress-note/milestone logging working; both verified live in Safari; committed with version + cache bump; `deploy-local.sh` run.
- Memory system updated (PROJECT_STATE, HANDOFF, ENGINEERING_LOG; this file replaced with S-14).

### Dependencies
- Locations service (exists). Event pipeline + timeline (exist). No new architecture.

### Risks
- Adding `quickLog` milestone types also adds them to task-type options (`taskSchedulerService.TASK_TYPE_OPTIONS`) — acceptable, verify it reads sensibly.
- Sprite additions must keep the file valid and precache unaffected (sprite already precached).

### Success Criteria
- Filtering Plants by a location shows only that location's plants; combines with category/status/search.
- From a plant, the owner can log a dated note and one-tap "Flowering"/"Fruiting"; entries appear on the plant timeline with date + text.
- Full suite green live in Safari; no console errors; app still installs/offline-loads.

---

## On deck (do not start until S-13 done)
- **S-14 — Photo-audit corrections:** apply confirmed category/botanical corrections via a guarded one-time routine (AD-009); optionally log audit health observations as pest/observation records. *Blocked on owner answering scope + the three ID flags (see HANDOFF → Paused).*
- **S-15 — v1.x stabilization & exit-gate support:** address any friction from real use; support owner exit gates (validation week, 200-photo perf, winter-crop cycle, recurrence soak); then finalize `1.5.0`.
