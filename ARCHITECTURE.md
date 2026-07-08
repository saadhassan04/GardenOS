# GardenOS — System Architecture

**Document status:** Living document · v1.0 · 2026-07-09
**Audience:** Anyone implementing, extending, or reviewing GardenOS over its 20-year lifetime.
**Rule:** Code that contradicts this document is wrong until this document is amended (via ADR in `docs/adr/`).

---

## 1. Architectural Goals & Constraints

| # | Goal | Consequence |
|---|---|---|
| G1 | Survive 20 years of evolution | Standards-only stack, zero framework lock-in, documented interfaces |
| G2 | Offline-first, forever | Local database is the source of truth; network is an enhancement |
| G3 | Zero cost | No paid services; free-tier/keyless APIs only, always optional |
| G4 | AI/cloud/IoT-ready without rewrite | Extension points and schemas reserved now (see §8–§11) |
| G5 | Data outlives devices | Open export format, versioned schema, migration framework |
| G6 | One engineer can maintain it | Vanilla JS, no build step required, small explicit modules |

**Hard constraints:** HTML5 · CSS3 · Vanilla ES6 modules · IndexedDB · LocalStorage · Service Workers · Web App Manifest. No runtime dependencies in v1.x.

---

## 2. Key Decisions (summary — full rationale in `docs/adr/`)

### D1 — Vanilla JavaScript over a framework
Frameworks churn (a 2026 React codebase will be legacy by 2032); the DOM API will not. Vanilla ES6 modules give us: zero supply-chain risk, zero build requirement, zero forced migrations, and complete understanding of every line. The cost — writing our own thin component/render helpers — is paid once in v1.0 and owned forever. *(ADR-0001)*

### D2 — IndexedDB as the primary store, LocalStorage for preferences only
IndexedDB is the only browser storage that is transactional, indexed, asynchronous, and large-capacity (GBs, including Blobs for images). LocalStorage is synchronous and tiny — restricted to UI preferences and small settings. *(ADR-0002)*

### D3 — Repository pattern over direct DB access
No UI or service code ever touches IndexedDB directly. Each collection gets a repository (`PlantRepository`, `EventRepository`, …) exposing typed async methods. This is the single most important decision for the future: cloud sync (v4.0) becomes a synchronizing repository decorator, not a rewrite.

### D4 — Event-sourced care history
Care actions (watering, fertilizing, repotting, harvests, treatments…) are **immutable event records** in one `events` collection, not mutable fields on plants. Derived state ("last watered") is computed/cached. This gives us the plant timeline for free, makes analytics and AI training data trivial, and is naturally sync-friendly (append-mostly).

### D5 — Soft deletes + sync-ready record envelope from day one
Every record carries `id` (UUIDv4), `schemaVersion`, `createdAt`, `updatedAt`, `deletedAt`. Costs nothing now; makes v4.0 conflict resolution (last-writer-wins + tombstones) possible without data migration.

### D6 — Hash-based SPA routing, no router library
A single `index.html` shell with `#/plants/:id`-style routes handled by a ~100-line router in `hooks/`. Works from `file://`-adjacent static hosting, needs no server rewrites, survives forever.

### D7 — Internal event bus for module decoupling
Modules publish domain events (`plant:created`, `event:logged`, `task:completed`) on a tiny pub/sub bus. The dashboard listens; modules never import each other. New modules (AI, weather) subscribe without touching existing code.

### D8 — Feature flags in `config/`
Every future capability ships dark behind a flag (`features.aiVision`, `features.weather`, …). Roadmap versions flip flags, not architecture.

---

## 3. Application Layers

```
┌───────────────────────────────────────────────────────────────┐
│ L5  UI LAYER                                                  │
│     pages/  components/  widgets/  styles/                    │
│     Renders state → DOM. Captures input. No business logic.   │
├───────────────────────────────────────────────────────────────┤
│ L4  APPLICATION LAYER                                         │
│     modules/  hooks/                                          │
│     Feature orchestration: wires pages to services, owns      │
│     feature state, handles routing & the event bus.           │
├───────────────────────────────────────────────────────────────┤
│ L3  BUSINESS LOGIC LAYER (SERVICES)                           │
│     services/                                                 │
│     Domain rules: scheduling, care logic, analytics,          │
│     horticulture knowledge, import/export, (weather, AI…).    │
│     Pure of DOM. Pure of storage details.                     │
├───────────────────────────────────────────────────────────────┤
│ L2  DATA LAYER                                                │
│     models/  database/                                        │
│     Entities, validation, repositories, migrations, seed.     │
│     The ONLY layer that knows IndexedDB exists.               │
├───────────────────────────────────────────────────────────────┤
│ L1  PLATFORM LAYER                                            │
│     pwa/  storage/  config/  utils/                           │
│     Service worker, manifest, LocalStorage wrapper,           │
│     constants, feature flags, pure utilities.                 │
└───────────────────────────────────────────────────────────────┘
```

**Dependency rule (enforced in review):** imports point strictly downward. L5→L4→L3→L2→L1. Skipping a layer downward is allowed (a page may use `utils/`); importing upward is never allowed. Sibling modules in L4 communicate only via the event bus.

---

## 4. Folder Responsibilities

| Folder | Layer | Responsibility | Never contains |
|---|---|---|---|
| `pages/` | L5 | One file per screen (Dashboard, Plants, PlantDetail, Tasks, KitchenGarden, Gallery, Notes, Settings). Composes components. | Business rules, DB calls |
| `components/` | L5 | Reusable UI primitives: PlantCard, EventForm, PhotoGrid, ConfirmDialog, Toast, EmptyState, StatChip… | Feature-specific logic |
| `widgets/` | L5 | Self-registering dashboard widgets (DueTasksWidget, StatsWidget, RecentPhotosWidget, WeatherWidget*). | Direct repo access (goes via services) |
| `styles/` | L5 | `tokens.css` (design tokens), `base.css`, `layout.css`, `components.css`, `themes.css`. | Inline hex values (tokens only) |
| `modules/` | L4 | Feature modules: `plantManager/`, `taskManager/`, `kitchenGarden/`, `imageManager/`, `notes/`, `dataManager/` (import/export/backup). Each owns its routes, wiring, and feature state. | DOM string soup, DB specifics |
| `hooks/` | L4 | Router, event bus, state store helper, `useConnectivity`, `useStorageQuota`. | Feature code |
| `services/` | L3 | `plantService`, `careEventService`, `taskSchedulerService`, `harvestService`, `analyticsService`, `backupService`, `importExportService`, `imageService` (+ future `weatherService`, `aiVisionService`, `syncService`, `sensorService` behind flags). | DOM access, IndexedDB API calls |
| `models/` | L2 | Entity factories + validators: `Plant`, `CareEvent`, `Task`, `Note`, `ImageRecord`, `SowingBatch`, `Harvest`, `PestRecord`, `Treatment`. Single place where a record's shape is defined. | Persistence code |
| `database/` | L2 | `db.js` (connection, versioning), `migrations/`, one repository per collection, `seed/` (Karachi sowing calendar, care presets, initial plant catalog). | UI or service logic |
| `pwa/` | L1 | `manifest.json`, `service-worker.js`, offline shell, cache strategy, update flow. | App logic |
| `storage/` | L1 | Typed LocalStorage wrapper for settings/preferences with schema + defaults. | Domain data (belongs in IndexedDB) |
| `config/` | L1 | `constants.js`, `featureFlags.js`, `climate.karachi.js`, event-type registry, category registry. | Mutable state |
| `utils/` | L1 | Pure functions only: `dates.js`, `uuid.js`, `format.js`, `imageResize.js`, `csv.js`, `checksum.js`. | Side effects, app state |
| `scripts/` | — | `app.js` bootstrap: registers SW, opens DB, runs migrations, mounts router. | Feature logic |
| `tests/` | — | Unit tests (models, services, utils) + integration tests (repositories against real IndexedDB, backup round-trip). | — |
| `assets/` | — | `icons/` (PWA icon set, UI SVGs), `images/` (static artwork). | User data |
| `backups/`, `export/`, `import/` | — | Developer-side artifact zones for backup archives, generated exports, and import staging during development. User-facing flows use browser download/upload. | Source code |
| `docs/` | — | Extended docs, ADRs (`docs/adr/`), diagrams. | — |

---

## 5. Data Flow

### 5.1 Write path — "Log watering for 6 plants"

```
User taps Water ▶ (PlantsPage, L5)
  → plantManager module handler (L4)
    → careEventService.logBulk({type:'watering', plantIds, at}) (L3)
      → validates via models/CareEvent (L2)
      → EventRepository.addMany(events) in ONE transaction (L2)
      → PlantRepository.updateDerived(lastWateredAt) (L2)
    ← service resolves
  → bus.emit('events:logged', {type:'watering', plantIds})
      ↳ DashboardWidget re-renders "due tasks"
      ↳ PlantsPage refreshes "last watered" chips
      ↳ Toast component confirms
```

### 5.2 Read path — "Open plant timeline"

```
Route #/plants/:id → plantManager module
  → plantService.getPlantWithSummary(id)        (plant + derived stats)
  → careEventService.getTimeline(id, {page})    (indexed query: [plantId+occurredAt])
  → imageService.getThumbnails(id, {limit})
  → PlantDetailPage renders; further pages lazy-load on scroll
```

### 5.3 Backup path

```
Settings → dataManager module → backupService.createArchive()
  → every repository .exportAll() (cursor-streamed)
  → images serialized (Blob → base64 or bundled binary)
  → archive = {meta:{app, schemaVersion, createdAt, checksum}, collections:{…}}
  → utils/checksum → browser download
Restore = reverse, with: validate checksum → validate schemaVersion →
  snapshot current DB → transactional import → verify counts → commit/rollback.
```

### 5.4 Startup sequence

```
index.html → scripts/app.js
  1. register service worker (pwa/)
  2. load settings (storage/) → apply theme instantly (no flash)
  3. open IndexedDB (database/db.js) → run pending migrations
  4. request persistent storage (navigator.storage.persist())
  5. init event bus + router (hooks/)
  6. register modules & dashboard widgets
  7. route to #/dashboard (or last route)
```

---

## 6. Storage Layer Design

Two stores, strictly divided:

| Store | Contents | Access |
|---|---|---|
| **IndexedDB** (`gardenos` DB) | All domain data: plants, events, tasks, notes, images (Blobs), sowing batches, harvests, pests, treatments, sensor readings (future), sync metadata (future) | Repositories only |
| **LocalStorage** (`gardenos.settings.*`) | Theme, units, dashboard layout, last route, backup-reminder timestamp, feature-flag overrides | `storage/` wrapper only |

- DB versioning via IndexedDB's native `version` + our `migrations/` registry (one migration file per version bump, forward-only, tested against fixture data). Full schema: [DATABASE.md](DATABASE.md).
- Images stored as Blobs with generated thumbnails (target ≤ 40 KB) so galleries never load full-resolution files.
- Quota management: `navigator.storage.estimate()` surfaced in Settings; warning thresholds at 70%/90%.

---

## 7. UI Layer Architecture

- **Rendering model:** small component functions returning DOM nodes (`document.createElement`-based helpers in `components/`), updated via targeted re-render of page regions — no virtual DOM, no innerHTML for user data (XSS hygiene).
- **State:** each module owns its feature state; a tiny observable store helper (`hooks/store.js`) provides subscribe/notify. Global app state is deliberately minimal (route, theme, connectivity).
- **Routing:** hash router with route registry contributed by modules (`plantManager` registers `#/plants`, `#/plants/:id`, …).
- **Design system:** all visual rules live in [UI_GUIDELINES.md](UI_GUIDELINES.md) and are encoded as CSS custom properties in `styles/tokens.css`. Dark theme default.
- **Widgets:** dashboard widgets self-register with a `WidgetRegistry` (`{id, title, render, refreshOn:[busEvents]}`) — adding a widget never modifies dashboard code (Open/Closed Principle).

---

## 8. Weather Layer (v2.5 — interface reserved now)

- `services/weatherService.js` implements the `IWeatherProvider` contract in [API_DESIGN.md](API_DESIGN.md) §3.
- Provider: **Open-Meteo** (free, keyless, CORS-enabled) with the Karachi coordinates from `config/climate.karachi.js`.
- Responses cached in IndexedDB (`weatherCache`) with TTL; the app never blocks on weather.
- Downstream consumers (task scheduler, plant doctor) consume **normalized weather objects**, never raw API responses — provider can be swapped via config.

## 9. Future AI Layer (v2.0 / v3.0 — interface reserved now)

- Contracts: `IPlantIdentifier`, `IDiseaseDetector`, `IGardenAdvisor` (API_DESIGN.md §4).
- Strategy: **on-device first** (TensorFlow.js / WebGPU models cached by the SW) to preserve offline-first and zero-cost; optional free-tier remote providers as pluggable alternates.
- AI writes back as first-class records: an analysis result attaches to the image/event that produced it (`analyses` collection reserved in DATABASE.md) — so AI history is part of the plant's story and future training data.
- The event-sourced history (D4) is the AI's context: watering prediction and the fertilizer advisor read the same `events` collection everything else uses.

## 10. Future Cloud & Sync Layer (v4.0 — designed for, not built)

- Sync engine = repository decorator: `SyncedRepository(baseRepo)` intercepts writes, appends to an `oplog` collection, and reconciles with a remote (free-tier object storage or user-owned endpoint; encrypted client-side).
- Enabled by D5's envelope (UUIDs, timestamps, tombstones). Conflict policy: last-writer-wins per field for mutable records; events are append-only so they merge trivially.
- Core promise preserved: the app remains fully functional with sync off or unreachable.

## 11. Future IoT & Digital Twin Layers (v5.0 / v6.0)

- `sensorReadings` collection reserved (DATABASE.md) — readings are just another event stream keyed to plants/locations.
- Ingestion via Web Bluetooth / Web Serial / local-network HTTP (all free, browser-native).
- Digital twin builds on the structured `location` model plants carry from v1.0 (area → position), adding geometry later without migrating plant identity.

---

## 12. Dependency Diagram

```
                 ┌────────────┐
                 │   pages    │
                 └─────┬──────┘
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
  ┌───────────┐  ┌───────────┐  ┌───────────┐
  │components │  │  widgets  │  │  styles   │
  └─────┬─────┘  └─────┬─────┘  └───────────┘
        │              │
        ▼              ▼
     ┌──────────────────────┐     ┌─────────┐
     │       modules        │◄───►│  hooks  │  (router, bus, store)
     └──────────┬───────────┘     └─────────┘
                ▼
     ┌──────────────────────┐
     │       services       │ ← weather / AI / sync plug in here
     └──────────┬───────────┘
        ┌───────┴────────┐
        ▼                ▼
  ┌───────────┐   ┌────────────┐
  │  models   │◄──│  database  │  (repositories, migrations)
  └─────┬─────┘   └─────┬──────┘
        │               │
        ▼               ▼
  ┌─────────────────────────────────────┐
  │  utils · config · storage · pwa     │
  └─────────────────────────────────────┘

  Arrows = "may import". Anything not drawn is forbidden.
```

---

## 13. Cross-Cutting Concerns

| Concern | Approach |
|---|---|
| Error handling | Services throw typed errors (`GardenOSError` hierarchy in `utils/errors.js`); modules translate to user-facing toasts; unhandled errors logged to a local ring buffer viewable in Settings → Diagnostics |
| Logging | `utils/logger.js` — leveled, local-only, no network |
| IDs | UUIDv4 via `crypto.randomUUID()` |
| Time | All persistence in ISO-8601 UTC; display in local time via `Intl` |
| Validation | At the model boundary (L2) — nothing invalid reaches a repository |
| Testing | Unit (pure logic) + integration (real IndexedDB via browser test runner); backup/restore round-trip test is release-gating |
| SW updates | New SW installs in background → in-app "Update available" prompt → skipWaiting on consent (never silently reload over unsaved input) |
| Security | No `innerHTML` with user data; strict same-origin; CSP meta tag; no third-party scripts |

---

## 14. Amendment Process

Architecture changes require an ADR in `docs/adr/` (copy `ADR-0000-template.md`), referencing the decision it supersedes. This document is then updated to match. History stays in git + CHANGELOG.md.
