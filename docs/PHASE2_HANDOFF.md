# GardenOS — Phase 2 Handoff (for a Sonnet implementation session)

> **Status: APPROVED (owner, 2026-10-07).** All §4 defaults accepted; D0 = GitHub Pages.
> Implement in the order of §6, starting with step 0 (deploy).

Written 2026-10-07 by the review session (Opus). Phase 1 found: solid internals (layered code, append-only
event log, batch Undo, 64 green tests), but weak daily UX — slow logging on a phone, no at-a-glance status,
fertilizer logged as a bare timestamp, harvests only possible from kitchen batches, a UTC date bug.

The owner logs **on the phone, in the garden**. Mac is secondary. Every design choice below optimises for
one-handed, thumb-reach, few-tap logging on a ~375px screen.

---

## 1. Session start — do these first, in order

1. **Read this file fully.** It supersedes the per-sprint ritual in `docs/project-memory/CLAUDE.md`
   (see §7). Skim `docs/project-memory/CLAUDE.md` only for coding conventions.
2. **Ponytail is on** (a SessionStart hook enables it; if not, run `/ponytail`). Follow its ladder on
   every change: does it need to exist → already in the codebase → stdlib/platform → minimum code.
3. **Build the code graph with graphify before reading source** (§2). After that, use graph queries to
   find code instead of opening files speculatively.

## 2. Graphify + ponytail: token-efficient way of working

The goal: as GardenOS grows, a session should cost tokens proportional to the *change*, not to the
*codebase*.

**One-time setup (first session only)**
- `/graphify .` from `GardenOS/` (the repo root). Code files go through the AST pass (no LLM tokens);
  the markdown docs go through the semantic pass once. Use `--no-viz` if the HTML is not wanted.
- Add `graphify-out/` to `.gitignore` (the graph is a local index, rebuilt from source).
- Read `graphify-out/GRAPH_REPORT.md` once — it names the "god nodes" (expect `utils/dom.js#el`,
  `hooks/bus.js`, `database/Repository.js`, `careEventService`) and the module communities.

**Every task after that**
- Locate before reading: `graphify query "where is watering due computed" --budget 1500`,
  `graphify path "TodayPage" "careEventService"`, `graphify explain "wateringSchedule"`.
- Open **only** the files the graph points to; read the function you need (Read with offset/limit),
  not whole files.
- After each increment is committed: `/graphify . --update` (incremental — re-extracts changed files
  only). Never do a full rebuild unless the graph is corrupt.

**Ponytail rules that matter most here**
- Reuse, don't re-implement: `el()`/`svgIcon()`/`clear()` (`utils/dom.js`), `formDialog`
  (`components/FormDialog.js`), `logEvent`/`logBulk`/`undoBatch` (`services/careEventService.js`),
  `wateringSchedule`/`effectiveWateringDays` (`services/careProfileService.js`), `getInbox`
  (`services/taskSchedulerService.js`), `listActivePests` (`services/pestService.js`).
- The "log → toast with Undo → refresh" pattern is copy-pasted ~6 times today. Extract it **once**
  (`components/logWithUndo.js`) when you build Today, and use it in new code. Do not refactor old pages
  to it unless you are already editing them.
- No new IndexedDB store, no migration, no new dependency is needed for anything in this phase.
- Leave **one** runnable check per non-trivial piece of logic: add cases to an existing
  `tests/*.test.js` (or one new file registered in `tests/runner.js`). No per-function suites.

## 3. Dev environment (verified 2026-10-07)

- **No Node.js.** Parse/import check: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m file.js`
  (ReferenceErrors about `window`/`document` = parsed fine; only SyntaxError/unresolved import = failure).
- Serve the repo for testing with `python3 tests/serve.py <fresh-port>` (no-cache server; plain
  http.server serves stale ES modules). Use a new port when the service worker holds an old shell.
- The **built-in browser pane works** (`mcp__Claude_Browser__*`): navigate to `http://127.0.0.1:<port>/`,
  `resize_window` preset `mobile` for phone checks. It has its **own** storage, so it seeds a fresh demo
  garden and cannot touch the owner's data.
- Tests: open `http://127.0.0.1:<port>/tests/index.html`; pass/fail is also written to `document.title`.
  They use a disposable `gardenos-test` DB.
- **Never** touch the owner's live install (`http://127.0.0.1:8080`, served from `~/GardenOS` by a
  LaunchAgent) and never run `deploy-local.sh` without the owner's explicit OK.
- Release checklist for any new/changed file: add it to `PRECACHE_URLS` in `pwa/service-worker.js` and
  bump `CACHE_VERSION`; bump `APP_VERSION` in `config/constants.js`. A file missing from the precache
  list breaks offline silently.

## 4. Owner decisions — all APPROVED 2026-10-07 (approved value in **bold**)

D0 resolved: **GitHub Pages** (chosen over Cloudflare Pages: `gh` is installed and logged in as
`saadhassan04`, no extra account or Node tooling needed, and every app path is already relative so a
`/GardenOS/` sub-path works). See §6 step 0.

| # | Decision | Default proposed |
|---|---|---|
| D0 | **How does the phone reach the app?** Today it is served at `127.0.0.1:8080` on the Mac, which a phone cannot open. Service workers + reliable IndexedDB need HTTPS or localhost, so plain LAN `http://192.168.x.x` gives no offline mode and no install. | **Free static HTTPS host (Cloudflare Pages or GitHub Pages). The app is static; data stays in the phone's browser and nothing is uploaded. Move data once: Mac → Settings → Back up → restore on phone.** Phone becomes the primary copy. Not blocking for coding; blocking for real use. |
| D1 | Today replaces Dashboard as the first nav tab and the `#/` route; Dashboard moves to More (`#/dashboard`). | **Yes** |
| D2 | Plants with **no watering logged yet** are not shown as "due" (that is 33 false alarms on a fresh garden). They go in a collapsed "No watering history" group with one "Mark all watered today" button. | **Yes** |
| D3 | Fertilizing becomes a **live schedule** like watering (profile/override interval vs last feed), shown in Today's "Feed" section. The Tasks page stops suggesting recurring fertilizing tasks. Existing fertilizing tasks stay as normal tasks; the owner deletes them when ready. | **Yes** |
| D4 | The plant-detail "Fertilizing" quick-log button opens the fertilizer sheet (one extra tap, but captures product). The sheet has a "Same as last time" button for a 2-tap log. | **Yes** |
| D5 | Seasonal pause for feeding (e.g. no feeding in May–June heat). | **No for now** — profiles stay one interval; add later if wanted. |
| D6 | The sticky "never backed up" toast is removed; Today shows a one-line backup banner instead. | **Yes** |

## 5. Design

### 5.1 Today screen (`#/` → `pages/TodayPage.js`)

**Layout (phone, single column, top to bottom)**

```
Wed 7 Oct · Winter season
12 to water · 2 to feed · 1 problem                [backup banner if due, one line]

WATER                                              (section hidden when empty)
  Rooftop · 6                      [Water all 6]
    ○ Bougainvillea      2d overdue          [💧]
    ○ Tomato             due today           [💧]
    ✓ Lemon              watered 8:10        (done today — stays, struck through)
  Balcony · 3                      [Water all 3]
    …
  No location · 2                  [Water all 2]
  ▸ No watering history (8)        [Mark all watered today]   (collapsed, D2)

FEED
    ○ Rose               every 30d · last 34d ago   → opens fertilizer sheet
      last used: Seaweed extract · 5 ml/L

PROBLEMS
    ● Rose — mealybug (high)   treated 5d ago · outcome?   → plant detail #pests
    ● Jasmine — aphid (low)    not treated yet

TASKS                                (pending custom/other tasks due today or overdue)
    ○ Repot Snake Plant   1d overdue                      [✓]

Tomorrow: 4 to water · 1 to feed                     (one muted line)

All clear state: "Nothing needs you today." + tomorrow line.
```

**Interaction rules**
- Row tap target ≥ 48px; the action button is on the **right** (thumb side).
- Water ✓ = `logEvent(plantId,'watering')`. "Water all N" = `logBulk(ids,'watering')` (one batch → one
  Undo for the whole group; this also covers "it rained on the rooftop").
- After a log, update **only that row/section** in place (row becomes ✓ "watered 8:10"). No full-page
  rebuild, no scroll jump. Undo toast (non-sticky) reverts and re-renders the section.
- "Done today" = `derived.lastWateredAt >= local start of today`. Done rows sort to the bottom of their group.
- Location groups are ordered by most items due; plants without `locationId` go in "No location".
- Feed row tap → fertilizer sheet (§5.2) prefilled for that plant.
- Problems: active + monitoring pest records, untreated first, then oldest treatment. Tap → plant detail.
- Tasks: `getInbox()` overdue + dueToday, ✓ = existing `completeTask` with Undo.
- Refresh on bus topics `events:logged`, `plant:*`, `pest:*`, `tasks:*` while mounted; unsubscribe on
  route change (copy the teardown pattern from `DashboardPage.js`).

**Code shape**
- `services/todayService.js`
  - `buildToday({plants, profiles, locations, tasks, pests}, now)` — **pure**, returns
    `{water: {groups: [{location, items}], noHistory: []}, feed: [], problems: [], tasks: [], tomorrow: {water, feed}, counts}`.
    This is where the one test goes (overdue/due/done-today/no-history/tomorrow at day boundaries).
  - `getToday(now = new Date())` — loads the inputs (existing services) and calls `buildToday`.
- `services/careProfileService.js`: add `effectiveFertilizeDays(plant, profile)`
  (`careOverrides.fertilizeEveryDays ?? profile.fertilizeEveryDays ?? null`) and a `fertilizeSchedule`
  that reuses the `wateringSchedule` arithmetic. Generalise the arithmetic into one private
  `cycle(everyDays, lastAt, now)` helper rather than duplicating it.
- `pages/TodayPage.js` + small CSS block in `styles/components.css` (tokens only, no raw values).
- `scripts/app.js`: register `/` → Today, `/dashboard` → Dashboard; nav slot 1 = Today (icon `home`);
  add Dashboard to `pages/MorePage.js` entries; replace the sticky backup toast (D6).
- Remove the fertilizing-suggestions block from `pages/TasksPage.js` (D3). Leave
  `suggestFromCareProfiles` in the service only if something else still calls it; otherwise delete it.

**No data changes** for Today — it is a read model over existing stores.

### 5.2 Fertilizer logging

**Data — no new store, no migration.** Fertilizing events keep living in the `events` log; their `data`
payload gets a shape:

```js
// events.data for type 'fertilizing' (all optional at model level so old {} events stay valid)
{
  product: 'Seaweed extract',     // string, trimmed; UI requires it for new logs
  npk: '20-20-20' | null,         // optional free text, validated loosely /^\d+(\.\d+)?-\d+(\.\d+)?-\d+(\.\d+)?$/
  dose: '5 ml/L',                 // free text (matches treatments.dose; real doses are "1 tsp/pot", "handful")
  method: 'soil-drench' | 'foliar' | 'top-dress' | 'slow-release' | 'other' | null,
  note: '...'                     // existing convention
}
```

- `models/CareEvent.js`: add a small per-type data validator map (`DATA_VALIDATORS = { fertilizing }`),
  applied after the generic checks. Unknown types fall through unchanged.
- `config/registries.js`: add `FERTILIZER_METHODS` labels next to the other vocabularies.

**Memory of what was used — derived, not stored.** The event log is the truth, so the product list is
computed from it (it can never drift, nothing extra to back up):
- `database/EventRepository.js`: add `listByType(type, {limit = 500})` (newest first, index
  `type_occurredAt`).
- `services/fertilizerService.js`:
  - `listUsedProducts()` → distinct products (case-insensitive key), each with the **latest**
    `{product, npk, dose, method, lastUsedAt, uses}`, sorted by recency. Also merge the care profiles'
    existing `fertilizer` strings as suggestions with `uses: 0`.
  - `defaultsForPlant(plantId)` → the plant's last fertilizing event data, else its profile's
    `fertilizer`, else the garden's most recent product.

**UI — `components/FertilizeDialog.js`** (bottom-sheet style `<dialog>`, reuse `.dialog` CSS)

```
Feed Rose                                   (or "Feed 6 plants" in bulk)
[Same as last time: Seaweed extract · 5 ml/L · foliar]      ← one-tap log (D4)

Recent:  (Seaweed extract) (DAP) (Vermicompost) (NPK 20-20-20) (Bone meal)   ← chips, tap fills all fields
Product  [Seaweed extract______]   (datalist of all used products)
Dose     [5 ml/L_______________]
Method   (Soil drench)(Foliar)(Top-dress)(Slow-release)(Other)   ← segmented
▸ More: NPK [____]  Date [today]  Note [____]

                                  [Cancel]  [Log feeding]
```

- Date defaults to **local** today (use the shared helper from §6 step 4), never the future.
- Entry points: Today Feed row; plant-detail Fertilizing button (D4); Plants bulk "Fertilize" (currently
  logs a bare event at `PlantsPage.js` `runBulk('fertilizing')` → open the sheet, then `logBulk` with `data`).
- Timeline line for fertilizing: `Fertilizing — Seaweed extract · 5 ml/L · foliar` (+ note).
  Change only `timelineItem` in `PlantDetailPage.js`.
- Plant detail profile section: "Last fed: Seaweed extract, 12 days ago".
- Task completion of an old fertilizing task still logs a bare event; acceptable (D3 retires them).

**Test:** `listUsedProducts` (dedupe by case, latest wins, profile suggestions merged) and the
fertilizing data validator (old `{}` accepted, bad NPK rejected).

## 6. Implementation order (one commit per step, ship each before the next)

0. **Deploy to GitHub Pages (D0)** — so the phone can use the app before any new feature lands.
   - Verified 2026-10-07: no git remote yet; `gh` authenticated; `.gitignore` already excludes
     `backups/`, `export/`, `import/` (no garden data is tracked). `pwa/manifest.json` and `sw.js`
     use relative paths, so `https://saadhassan04.github.io/GardenOS/` works without code changes.
   - Free GitHub Pages needs a **public** repo. The public code will include the owner's plant names
     (`database/seed/ownerGarden.karachi.js`) and the commit author email. **Tell the owner this and
     get an explicit yes before creating the repo** (it's outward-facing). If they want a private repo
     instead, use Cloudflare Pages connected to a private GitHub repo (dashboard steps; owner does the
     Cloudflare signup).
   - Steps: `gh repo create GardenOS --public --source . --push`, then enable Pages from `main` / root:
     `gh api -X POST repos/saadhassan04/GardenOS/pages -f 'source[branch]=main' -f 'source[path]=/'`.
     Confirm the site loads in the browser pane and the service worker registers.
   - **Owner's one-time data move (owner does this, guide them):** Mac `http://127.0.0.1:8080` →
     Settings → Back up → get the file to the phone (AirDrop/Files) → phone opens the Pages URL →
     Settings → Restore → Add to Home Screen. After that, **the phone is the primary copy**; the Mac
     copy at :8080 is stale and should not be used for logging.
   - From now on every shipped step = commit + `git push` (Pages redeploys in ~1 min). Always bump
     `CACHE_VERSION` so the phone shows the "Update available" prompt.
   - The LaunchAgent at :8080 can stay for now; the owner may retire it later.
1. **Today screen** (§5.1) + logWithUndo helper + nav/route change + backup banner.
2. **Fertilizer logging** (§5.2). The Today Feed section's tap action lands here.
3. **Harvest from any plant** — *outline; confirm the design with the owner before coding.*
   `logHarvest` already accepts `plantId` and writes a `harvest` event (`services/kitchenGardenService.js`).
   Missing: UI. Proposal: "Harvest" quick-log on plant detail for categories vegetable/herb/tree (and
   any plant with a past harvest) → `formDialog` with quantity, unit, quality, date; crop defaults to the
   plant name. Yield totals then include plant harvests automatically.
4. **UTC date bug** — `new Date().toISOString().slice(0, 10)` gives the UTC date; in Karachi (UTC+5)
   between 00:00–05:00 that is *yesterday*, and as a `max` it **blocks selecting today**. Occurrences:
   `components/FormDialog.js:55` (max), `components/PlantPestSection.js:140`,
   `pages/KitchenGardenPage.js:241, 277, 302`, `pages/TasksPage.js:369`.
   `components/EventFormDialog.js` already has a correct `localDateString()` — move it to
   `utils/dates.js`, export it, use it everywhere. (Small enough to do first if convenient.)
5. **Plant cards** — *outline; confirm with the owner.* Compact list rows on phone instead of the
   2-column photo cards (photo becomes a small thumbnail, empty-photo boxes disappear); show next-water,
   an active-pest dot, and last-fed. Collapse the 5 filter selects behind one "Filters" button.
   Plant "health" status needs a data decision (new field vs derived from pests) — ask first.

## 7. Process (simplified — owner approved 2026-10-07)

- Per increment: code → test green in browser → phone-width check in the browser pane → commit
  (Conventional Commits) → update **CHANGELOG.md** and the **Progress log** below. That's all.
- Do **not** update the other `docs/project-memory/*` files per sprint. Update `PROJECT_STATE.md`
  once at the end of the phase.
- Reserved empty stores (`analyses`, `weatherCache`, `sensorReadings`, `oplog`) are **frozen**: don't
  use them, don't spend a migration deleting them.
- Owner-specific startup routines (`ensureGardenRecategorized`, `ensurePhotoAuditCorrected`) — leave
  alone this phase.
- Keep: the event log, batch Undo, the repository layer, zero dependencies, offline-first.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## 8. Progress log

| Date | Step | Commit | Notes |
|---|---|---|---|
| 2026-10-07 | Phase 1 review + Phase 2 proposal | — | This file. |
| 2026-10-07 | Owner approval | — | All §4 defaults approved; D0 = GitHub Pages. Next: §6 step 0. |
| 2026-10-07 | 0 Deploy | 0402c3e | Public repo + Pages live at https://saadhassan04.github.io/GardenOS/ ; SW registers. Owner still needs to move data (Back up on Mac -> Restore on phone). |
