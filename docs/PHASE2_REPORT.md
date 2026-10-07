# GardenOS — Phase 2 Status Report

Written 2026-10-08, end of the Phase 2 session. For the owner to evaluate later.
Companion docs: [PHASE2_HANDOFF.md](PHASE2_HANDOFF.md) (plan + per-step log), [CHANGELOG.md](../CHANGELOG.md), [project-memory/PROJECT_STATE.md](project-memory/PROJECT_STATE.md).

## 1. Where things stand

| | |
|---|---|
| App version | `1.6.0-dev.12` (live and confirmed working on the owner's phone) |
| Live URL | https://saadhassan04.github.io/GardenOS/ (GitHub Pages, redeploys on every push to `main`) |
| Repository | https://github.com/saadhassan04/GardenOS — **public** |
| Branch state | `main` clean, everything pushed (latest `b2c78ce` at time of writing) |
| Tests | 66 / 66 passing (was 64 at the start of Phase 2) |
| Phase 2 commits | ~31 (features, fixes, and one doc commit per step) |
| Data model | No schema change, no new store, no migration, no new dependency |
| Data location | The phone is the primary copy. The Mac is a viewer refreshed by restoring a backup. |

## 2. What was delivered

Planned steps from the handoff:

| Step | Delivered |
|---|---|
| 0 Deploy | Public repo + GitHub Pages. Phone installs the PWA from the link. |
| 1 Today screen | New first tab / `#/` route. Water due grouped by location, "Water all N" with one Undo, done-today rows struck through, live feeding schedule, active problems, due tasks, tomorrow preview, backup banner. Plants with no watering history are collapsed (no false alarms). Dashboard moved to More. |
| 2 Fertilizer logging | Product, dose, method, optional NPK stored on the event. Feed sheet with "Same as last time" (2-tap log), recent-product chips, short form. Entry points: Today, plant detail, Plants bulk. Products list is derived from the event log. |
| 3 Harvest from any plant | Harvest button on vegetable / herb / tree plants and any plant harvested before. Shared harvest sheet with Kitchen. |
| 4 UTC date bug | All six date-field spots use the local date (`localDateString`). Also fixed "harvest/sow today before noon rejected as future". |
| 5 Plant rows | Compact rows (thumbnail, name, next water, last fed, water button), red pest dot (health derived from pests), Filters behind one button. |

Added after the plan, at the owner's request:

- **UI polish:** Today progress, "All clear", skeleton, motion (fade, press, sheet/toast slide-up, reduced-motion respected), plant-row status stripe, quick chips ("Due today", "Has pest"), sticky search.
- **Premium visual pass:** deeper green palette, gradient cards, glass nav with active pill, gradient buttons, softer inputs, blurred sheet/toast backdrops, wide-screen layout (full-width pages, Today in two columns).
- **Tasks, Kitchen, plant detail polish:** task rows with type icons and round check, sowing-batch cards with a stage progress bar, plant header with cover photo and a two-column quick-log grid.
- **Today hero:** progress ring, one big "Water all N" button, three tap-to-jump stat tiles, time-of-day greeting ("Late night" 22:00–04:59).
- **Phone → Mac hand-off:** "Send backup…" opens the phone share sheet, with fallbacks; a 3-step guide sits in Settings.
- **Update reliability:** auto-apply a fresh update right after launch, Settings → "Check for updates" and "Refresh app files", `reset.html` recovery page, precache bypasses the HTTP cache.

## 3. Bugs found and fixed along the way

- Today showed the word **"null"** (an empty section was appended as `null`). It only appeared when every plant had watering history, which is why test data never showed it.
- **Stale phone version:** the new version installs ~2 s after launch and needed an unnoticed tap; the new cache could also fill with stale files. Fixed (see above).
- Share sheet fell back to Downloads on Android (JSON type refused / tap timing). Fixed with a text/plain fallback and a two-tap "Backup ready" step.
- Empty bulk action bar appeared as a stray pill above the nav.
- Pages were squeezed into a narrow column on wide screens.
- "Due today" filter listed never-watered plants (disagreed with Today).
- Progress ring didn't draw: the page's security policy blocks inline `style` attributes; value now set via the DOM.
- Greeting said "Good morning" at 1am.

## 4. How it was verified

- Parse check of every changed file (JavaScriptCore), then the full browser test suite (disposable test DB) before each commit.
- Phone-width (375px) and 1280px checks in the browser pane, using a separate demo garden — never the owner's data.
- The update bug was reproduced on the live Pages site and the recovery link was proven there (34 plants intact after it).
- Owner confirmed on the real phone: app installed, data restored, update/recovery now working.

## 5. Known gaps and risks (be aware when evaluating)

1. **Notifications don't work on the owner's phone.** Brave blocks them, and GardenOS has no server, so it can only notify while the app is open. Real reminders need a server. Parked.
2. **No automatic sync.** Phone is the master; the Mac is refreshed manually through backup → restore. Restore replaces everything on the Mac and downloads a safety copy each time (files pile up in Downloads).
3. **The Mac install at `127.0.0.1:8080` is still the old version** and was deliberately never touched. `deploy-local.sh` was not run.
4. **Public repository.** Plant names (`database/seed/ownerGarden.karachi.js`) and the commit author name/hostname are public. No garden data or secrets are in the repo.
5. **Auto-apply update is brand new.** It can only be proven on the *next* release; this release reached the phone through the recovery link.
6. **Phone share sheet** was fixed and simulated, but the owner hasn't confirmed the final behaviour on the Xiaomi / Brave.
7. **Dashboard "Needs attention"** still lists never-watered plants (Today hides them by design). Inconsistent; left as is.
8. **Today's Feed section hides never-fed plants** (same false-alarm reasoning). They appear after a first feeding is logged.
9. **Kitchen batch harvest** was refactored to the shared sheet; only parse-checked on the batch path (the demo garden had no batches at that moment, later added but not exercised).
10. **No automated UI tests.** Presentational work was checked by eye in the pane. Logic additions have tests: `buildToday`, fertilizer validator and products list.
11. **The graph (`graphify`)** covers code only. The doc/image semantic pass was skipped to save tokens. `graphify-out/` is git-ignored.
12. `PROJECT_STATE.md` was updated at the Phase 2 close; a later refresh (polish + update fixes) is recommended before Phase 3.

## 6. Suggested next steps

1. Use the app for a week on the phone; list what feels slow, wrong, or missing.
2. Decide on notifications (needs a small server) and sync, both of which would change the "no accounts, no servers" rule.
3. Retire or update the Mac `:8080` install (run `deploy-local.sh` only with the owner's go-ahead).
4. Make Dashboard consistent with Today, and consider a "Never fed" group.
5. Refresh `PROJECT_STATE.md` and run the optional graph semantic pass.

## 7. Where things live

- Plan, decisions and per-step log: `docs/PHASE2_HANDOFF.md`
- Release notes: `CHANGELOG.md`
- Today: `pages/TodayPage.js`, `services/todayService.js`, `components/logWithUndo.js`
- Fertilizer: `components/FertilizeDialog.js`, `services/fertilizerService.js`, `models/CareEvent.js`
- Harvest: `components/HarvestDialog.js`
- Plant rows: `components/PlantCard.js`, `pages/PlantsPage.js`
- Update machinery: `scripts/app.js`, `pwa/service-worker.js`, `reset.html`, Settings page
- Styling: `styles/tokens.css` (palette, gradients, shadows) and `styles/components.css`
