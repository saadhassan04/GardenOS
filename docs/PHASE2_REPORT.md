# GardenOS — Phase 2 Status Report (final)

Regenerated 2026-10-08 after the self-update fix. For the owner to evaluate later.
Companion docs: [PHASE2_HANDOFF.md](PHASE2_HANDOFF.md) (plan + per-step log), [CHANGELOG.md](../CHANGELOG.md), [project-memory/PROJECT_STATE.md](project-memory/PROJECT_STATE.md).

## 1. Where things stand

| | |
|---|---|
| App version | `1.6.0-dev.16` |
| Live URL | https://saadhassan04.github.io/GardenOS/ (GitHub Pages, redeploys on every push to `main`) |
| Repository | https://github.com/saadhassan04/GardenOS — **public** |
| Branch state | `main` clean, everything pushed |
| Tests | 67 / 67 passing (64 at the start of Phase 2) |
| Phase 2 commits | ~35 (features, fixes, one doc commit per step) |
| Data model | No schema change, no new store, no migration, no new dependency |
| Data location | The phone is the primary copy. The Mac is a viewer refreshed by restoring a backup. |
| Phone | Installed, real data restored, updates confirmed working (via `reset.html`) |

## 2. What was delivered

### The six planned steps
| Step | Delivered |
|---|---|
| 0 Deploy | Public repo + GitHub Pages. The phone installs the PWA from the link. |
| 1 Today screen | First tab / `#/` route. Water due grouped by location, "Water all N" with one Undo, done-today rows struck through, live feeding schedule, active problems, due tasks, tomorrow preview, backup banner. Plants with no watering history are collapsed (no false alarms). Dashboard moved to More. |
| 2 Fertilizer logging | Product, dose, method, optional NPK stored on the event. Feed sheet with "Same as last time" (2-tap log), recent-product chips, short form. Entry points: Today, plant detail, Plants bulk. The products list is derived from the event log. |
| 3 Harvest from any plant | Harvest button on vegetable / herb / tree plants and any plant harvested before. Shared harvest sheet with Kitchen. |
| 4 UTC date bug | All six date-field spots use the local date. Also fixed "harvest/sow today before noon rejected as future". |
| 5 Plant rows | Compact rows (thumbnail, name, next water, last fed, water button), red pest dot (health derived from pests), Filters behind one button. |

### Added at the owner's request
- **UI polish and motion:** Today progress, "All clear", loading skeleton; screen fade-in, press feedback, sheet/toast slide-up (reduced-motion respected); plant-row status stripe; quick chips ("Due today", "Has pest"); sticky search.
- **Premium visual pass:** deeper green palette, gradient cards, glass bottom nav with an active pill, gradient buttons, softer inputs, blurred sheet/toast backdrops, wide-screen layout (full-width pages, Today in two columns).
- **Tasks, Kitchen, plant detail polish:** task rows with type icons and a round check; sowing-batch cards with a stage progress bar; plant header with cover photo; two-column quick-log grid.
- **Today hero:** progress ring, one big "Water all N" button, three tap-to-jump stat tiles, time-of-day greeting ("Late night" 22:00–04:59).
- **Phone → Mac hand-off:** "Send backup…" opens the phone share sheet (with fallbacks) and a 3-step guide in Settings.
- **Update reliability:** a waiting update is applied at launch, after any check, and on navigation whenever nothing is being typed (works for slow installs and for updates that finished while the app was closed); the app re-checks on resume and hourly; the service worker is registered with `updateViaCache: 'none'`; Settings has "Check for updates" and "Refresh app files"; `reset.html` recovers a stuck phone without touching data; the precache bypasses the HTTP cache.
- **Tasks cleanup and bulk actions (latest):**
  - Tasks for plants that are deceased, archived or deleted are hidden everywhere (Tasks, Today, nav badge, calendar). Tasks shows "N tasks belong to plants that are no longer active" with a **Remove them** button that deletes those tasks and their repeats. Plant history is kept, and restoring a plant brings its tasks back until you remove them.
  - **Select mode** on Tasks: tick rows, "Select all" per section, narrow by type (e.g. **Fertilizing**) with chips, then **Skip**, **Done** or **Delete** for all of them at once. Skip and Done have one Undo for the whole batch; Delete asks first. Skipping a repeating task pushes it a full cycle; a one-off task is dismissed. Checked at phone width: 6 fertilizing tasks skipped in a few taps.

## 3. Bugs found and fixed along the way
- Today showed the word **"null"** (an empty section was appended as `null`); it only appeared when every plant had watering history.
- **Stale phone version (twice):** first, the update bar was easy to miss and the new cache could fill with stale files; then the auto-switch only worked within 30 s of opening, ignored an update that finished while the app was closed, and a script could be served stale for 10 minutes. All fixed in dev.14.
- **Deceased/archived plants' tasks** kept appearing (latest fix).
- Share sheet fell back to Downloads on Android (JSON type refused / tap timing).
- Empty bulk action bar showed as a stray pill above the nav.
- Pages were squeezed into a narrow column on wide screens.
- "Due today" filter listed never-watered plants (disagreed with Today).
- Progress ring didn't draw: the page security policy blocks inline `style` attributes; now set through the DOM.
- Greeting said "Good morning" at 1am.

## 4. How it was verified
- Parse check of every changed file (JavaScriptCore), then the full browser test suite (disposable test DB) before each commit. New logic has tests: `buildToday`, the fertilizer validator and products list, orphaned-task hiding/removal and undo-skip.
- Phone-width (375px) and 1280px checks in the browser pane on a separate demo garden — never the owner's data.
- The update bug was reproduced on the live Pages site, and the recovery link was proven there (34 plants intact afterwards).
- Owner confirmed on the real phone: installed, data restored, update/recovery working.

## 5. Known gaps and risks
1. **Notifications don't work on the owner's phone.** Brave blocks them, and with no server the app can only notify while open. Real reminders need a server. Parked.
2. **No automatic sync.** Phone is the master; the Mac is refreshed by backup → restore. Restore replaces everything on the Mac and downloads a safety copy each time (they pile up in Downloads).
3. **The Mac install at `127.0.0.1:8080` is still the old version** and was deliberately never touched; `deploy-local.sh` was not run.
4. **Public repository.** Plant names (`database/seed/ownerGarden.karachi.js`) and the commit author name/hostname are public. No garden data or secrets are in the repo.
5. **Self-update (dev.14+):** verified on the live site across versions 14→15 (page open and idle) and 15→16 (update finished while the app was closed). A phone still on dev.12/13 needs ONE manual step to reach dev.14 or later: More → Settings → About → "Check for updates" (or `reset.html` as a last resort). After that, updates apply by themselves. Not yet confirmed on the owner's actual phone.
6. **Skipping tasks:** a skipped repeating task is pushed one cycle from *today*, not from its old due date. A skipped one-off task is simply dismissed (no "snooze 1 week" yet).
7. **Hidden tasks reappear if you restore a plant** to active, until you press "Remove them".
8. **Phone share sheet:** fixed and simulated, but the owner has not confirmed the final behaviour on the Xiaomi / Brave.
9. **Dashboard "Needs attention"** still lists never-watered plants (Today hides them by design). Inconsistent; left as is.
10. **Today's Feed hides never-fed plants** until a first feeding is logged.
11. **Kitchen batch harvest** was refactored to the shared sheet and only lightly exercised.
12. **No automated UI tests.** Visual work was checked by eye; logic additions have tests.
13. **The `graphify` code graph** covers code only (doc/image pass skipped to save tokens); `graphify-out/` is git-ignored.
14. `PROJECT_STATE.md` says dev.13; refresh before Phase 3. Releases dev.15 and dev.16 are version bumps used only to test self-update.

## 6. Suggested next steps
1. Use the app for a week on the phone and list what feels slow, wrong or missing.
2. Check that dev.13 reaches the phone by itself (open the app, wait ~15 s, look at More → Settings → About).
3. Decide on notifications and sync; both would need a small server and change the "no accounts, no servers" rule.
4. Update or retire the Mac `:8080` install (with the owner's go-ahead).
5. Possible small follow-ups: "snooze a week" for tasks, a "Never fed" group on Today, Dashboard consistent with Today.
6. Refresh `PROJECT_STATE.md`.

## 7. Where things live
- Plan, decisions and per-step log: `docs/PHASE2_HANDOFF.md`
- Release notes: `CHANGELOG.md`
- Today: `pages/TodayPage.js`, `services/todayService.js`, `components/logWithUndo.js`
- Tasks: `pages/TasksPage.js`, `services/taskSchedulerService.js` (orphan filter, `undoSkip`, cleanup)
- Fertilizer: `components/FertilizeDialog.js`, `services/fertilizerService.js`, `models/CareEvent.js`
- Harvest: `components/HarvestDialog.js`
- Plant rows: `components/PlantCard.js`, `pages/PlantsPage.js`
- Update machinery: `scripts/app.js`, `pwa/service-worker.js`, `reset.html`, Settings page
- Styling: `styles/tokens.css` (palette, gradients, shadows) and `styles/components.css`
