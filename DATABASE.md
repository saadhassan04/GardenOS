# GardenOS — Database Design (IndexedDB)

**Document status:** Living document · Schema version 1 (design) · 2026-07-09
**Database name:** `gardenos` · **Engine:** IndexedDB · **Access:** repositories in `database/` only (ARCHITECTURE.md D3)

---

## 1. Design Principles

1. **Event-sourced care history.** Mutable "current state" lives on entity records; everything that *happens* is an immutable record in `events`. Derived fields (e.g., `lastWateredAt`) are caches, always recomputable from events.
2. **Sync-ready envelope on every record** (ARCHITECTURE.md D5):

   ```js
   {
     id: "uuid-v4",              // primary key, crypto.randomUUID()
     schemaVersion: 1,           // record-level version for lazy upgrades
     createdAt: "ISO-8601 UTC",
     updatedAt: "ISO-8601 UTC",
     deletedAt: null | "ISO"     // soft delete (tombstone)
   }
   ```
3. **No cross-store joins in IndexedDB** — relationships are by UUID reference; repositories provide the join logic; hot paths are covered by compound indexes.
4. **Denormalize only measured hot paths**, and document every denormalization here.
5. **Blobs in the DB** (images) so a single backup archive captures everything.
6. **Forward-only, versioned migrations.** Never mutate schema outside a migration.

---

## 2. Object Stores (Collections)

Sixteen stores in schema v1. Stores marked 🔮 are created empty now (cheap) so future versions need no structural migration for their arrival.

| # | Store | Purpose | Arrives |
|---|---|---|---|
| 1 | `plants` | Every plant, tree, seedling, propagation | v1.1 |
| 2 | `events` | All care/lifecycle events (immutable) | v1.1 |
| 3 | `tasks` | One-off & recurring tasks | v1.5 |
| 4 | `notes` | Garden notes | v1.1 |
| 5 | `images` | Photo blobs + metadata | v1.2 |
| 6 | `thumbnails` | Small preview blobs (1:1 with images) | v1.2 |
| 7 | `sowingBatches` | Kitchen-garden sowing lifecycle | v1.3 |
| 8 | `harvests` | Harvest quantities | v1.3 |
| 9 | `pestRecords` | Pest/disease observations | v1.1 |
| 10 | `treatments` | Treatments applied & outcomes | v1.1 |
| 11 | `locations` | Garden areas (balcony, roof, front bed…) | v1.1 |
| 12 | `careProfiles` | Reusable care templates per species | v1.1 |
| 13 | `appMeta` | Schema version, install id, backup history | v1.0 |
| 14 | 🔮 `analyses` | AI vision results attached to images | v2.0 |
| 15 | 🔮 `weatherCache` | Cached normalized forecasts | v2.5 |
| 16 | 🔮 `sensorReadings` + `oplog` | IoT readings · sync operation log | v5.0 · v4.0 |

---

## 3. Store Schemas

### 3.1 `plants` — keyPath `id`

```js
{
  ...envelope,
  name: "Black Plumeria",             // required, only mandatory field
  botanicalName: "Plumeria rubra",    // optional
  category: "flower",                 // registry: flower|indoor|outdoor|tree|vegetable|herb|seedling|propagation
  status: "active",                   // active|dormant|archived|deceased
  acquiredAt: "2024-03-15",
  parentPlantId: null | "uuid",       // propagation lineage → plants.id
  locationId: "uuid",                 // → locations.id
  location: {                         // structured for v6.0 digital twin
    areaId: "uuid", position: null | {x, y}, sunExposure: "full|partial|shade|indoor-bright|indoor-low"
  },
  container: { type: "clay-pot", sizeInches: 12, drainage: true } | null,   // null = in-ground
  soilMix: "50% garden soil, 30% compost, 20% sand",
  careProfileId: null | "uuid",       // → careProfiles.id (template; per-plant overrides below)
  careOverrides: { wateringEveryDays: 2, fertilizeEveryDays: 30, ... } | null,
  derived: {                          // caches — recomputable from events
    lastWateredAt: "ISO" | null,
    lastFertilizedAt: "ISO" | null,
    lastRepottedAt: "ISO" | null,
    eventCount: 0,
    imageCount: 0
  },
  coverImageId: null | "uuid",        // → images.id
  tags: ["fragrant", "balcony"],
  notes: "free text"
}
```

**Indexes:** `category` · `status` · `locationId` · `parentPlantId` · `name` · compound `[status+category]` (the main list query).

### 3.2 `events` — keyPath `id` (immutable; corrections append a superseding event)

```js
{
  ...envelope,
  plantId: "uuid",                    // → plants.id (or null for garden-wide events)
  type: "watering",                   // registry in config/: watering|fertilizing|repotting|pruning|
                                      // deadheading|pest-observation|treatment|harvest|observation|
                                      // stage-change|planted|propagated|moved|archived
  occurredAt: "ISO-8601",             // when it happened (backdatable) — NOT createdAt
  batchId: null | "uuid",             // groups bulk actions ("watered 6 plants") for undo/display
  imageIds: ["uuid"],                 // → images.id
  data: { /* type-specific payload, validated per type in models/ */ }
  // watering:    { amount: "normal|light|deep", method: "can|hose|drip" }
  // fertilizing: { product, npk, dose, unit }
  // repotting:   { fromSize, toSize, soilMix }
  // treatment:   { treatmentId }        // → treatments.id
  // harvest:     { harvestId }          // → harvests.id
  // stage-change:{ sowingBatchId, from, to }
  // moved:       { fromLocationId, toLocationId }
}
```

**Indexes:** `plantId` · `type` · `occurredAt` · `batchId` · **compound `[plantId+occurredAt]`** (timeline — the hottest query) · compound `[type+occurredAt]` (analytics).

### 3.3 `tasks` — keyPath `id`

```js
{
  ...envelope,
  title: "Fertilize roses",
  taskType: "fertilizing" | ...eventTypes | "custom",
  plantIds: ["uuid"], locationId: null | "uuid",
  dueAt: "ISO-8601",
  recurrence: null | {                // null = one-off
    pattern: "daily|everyNDays|weekly|monthly|seasonal",
    interval: 3,                      // for everyNDays
    daysOfWeek: [1,4],                // for weekly
    season: "monsoon|winter|summer",  // config/climate.karachi.js date ranges
    endAt: null | "ISO"
  },
  status: "pending|done|skipped",
  completedAt: null | "ISO",
  completedEventBatchId: null | "uuid",   // link to auto-logged care events
  seriesId: null | "uuid",                // stable id across recurring instances
  notes: ""
}
```

**Indexes:** `status` · `dueAt` · `seriesId` · compound `[status+dueAt]` (due/overdue query) · multiEntry `plantIds`.

### 3.4 `notes` — keyPath `id`
`{ ...envelope, title, body, plantIds: [uuid] (multiEntry), imageIds: [uuid], tags: [string] (multiEntry), pinned: 0 | 1 }`
**Indexes:** `plantIds` (multiEntry) · `tags` (multiEntry) · `updatedAt` · `pinned`.

### 3.5 `images` — keyPath `id` · 3.6 `thumbnails` — keyPath `imageId`

```js
// images
{ ...envelope, blob: Blob, mimeType: "image/webp", width, height, byteSize,
  capturedAt: "ISO",                  // EXIF date if available, else upload time
  plantId: null | "uuid", eventId: null | "uuid", noteId: null | "uuid",
  caption: "", tags: [string] }
// thumbnails (kept separate so galleries never touch full blobs)
{ imageId: "uuid", blob: Blob (webp ≤ ~40KB), width, height }
```

**Indexes (images):** `plantId` · `eventId` · `capturedAt` · compound `[plantId+capturedAt]` (growth gallery).

### 3.7 `sowingBatches` — keyPath `id`

```js
{ ...envelope, crop: "Tomato", variety: "Roma", plantId: null | "uuid",
  sownAt: "ISO", quantity: 24, medium: "seed-tray", locationId: "uuid",
  stage: "sown",                      // sown|germinated|transplanted|flowering|fruiting|harvesting|finished
  stageHistory: [{ stage, at }],      // denormalized mirror of stage-change events for fast display
  expectedHarvestWindow: { from: "ISO", to: "ISO" } | null }
```

**Indexes:** `crop` · `stage` · `sownAt` · compound `[stage+sownAt]`.

### 3.8 `harvests` — keyPath `id`
`{ ...envelope, sowingBatchId | plantId, crop, harvestedAt, quantity: 1.25, unit: "kg|g|count|bunch", quality: "excellent|good|fair|poor", notes }`
**Indexes:** `crop` · `harvestedAt` · `sowingBatchId` · `plantId` · compound `[crop+harvestedAt]` (season totals).

### 3.9 `pestRecords` — keyPath `id`
`{ ...envelope, pestType: "mealybug", plantIds: [uuid] (multiEntry), severity: "low|medium|high", observedAt, status: "active|monitoring|resolved", resolvedAt, imageIds, notes }`
**Indexes:** `pestType` · `status` · `plantIds` (multiEntry) · `observedAt`.

### 3.10 `treatments` — keyPath `id`
`{ ...envelope, pestRecordId: null | "uuid", plantIds: [uuid] (multiEntry), product: "Neem oil", type: "organic|chemical|cultural", dose, method, appliedAt, outcome: null | "effective|partial|ineffective", outcomeNotedAt, notes }`
**Indexes:** `pestRecordId` · `plantIds` (multiEntry) · `appliedAt` · `product`.

### 3.11 `locations` — keyPath `id`
`{ ...envelope, name: "East Balcony", kind: "balcony|rooftop|bed|indoor-room|greenhouse|other", sunProfile: "full-am|full-pm|full-day|partial|shade", geometry: null /* 🔮 v6.0 */, notes }`
**Indexes:** `name` · `kind`.

### 3.12 `careProfiles` — keyPath `id`
`{ ...envelope, name: "Plumeria (Karachi)", species: "Plumeria", wateringEveryDays, wateringSeasonal: { summer, monsoon, winter }, fertilizeEveryDays, fertilizer: "", repotEveryMonths, pruningNotes, seasonalNotes: { heatWave: "...", monsoon: "..." }, source: "seed|user" }`
**Indexes:** `species` · `name`. Seeded with Karachi-tuned presets for the current collection.

### 3.13 `appMeta` — keyPath `key` (no envelope; internal)
Rows: `schemaVersion` · `installId` · `installedAt` · `lastBackupAt` · `backupHistory: [{at, byteSize, checksum}]` · `migrationLog: [{from, to, at, ok}]`.

### 3.14 🔮 Reserved stores (created empty in v1, populated later)

- **`analyses`** (v2.0) — keyPath `id`: `{ ...envelope, imageId, plantId, kind: "identification|disease|health", provider: "tfjs-model@x", result: {...}, confidence: 0.87, userVerdict: null | "confirmed|corrected", correction: {...} }`. Indexes: `imageId` · `plantId` · `kind`.
- **`weatherCache`** (v2.5) — keyPath `key` (`"forecast:karachi:2027-08-01"`): `{ key, fetchedAt, ttlSeconds, normalized: {...} }`.
- **`sensorReadings`** (v5.0) — keyPath `id`, autoIncrement: `{ sensorId, plantId | locationId, metric: "soilMoisture|temp|humidity|lux", value, unit, at }`. Indexes: compound `[sensorId+at]` · `[plantId+at]`.
- **`oplog`** (v4.0) — keyPath `seq`, autoIncrement: `{ seq, store, recordId, op: "put|delete", at, synced: 0 | 1 }`. Index: `synced`.

---

## 4. Relationships

```
locations 1 ──── * plants ──── * events (plantId)
                   │  │            │
     (parentPlantId│  │coverImage  │batchId groups bulk logs
      self-ref) *──┘  │            ├── treatments (via data.treatmentId)
                      │            └── harvests   (via data.harvestId)
careProfiles 1 ─── * plants
plants 1 ──── * images ──── 1 thumbnails ──── 0..1 analyses 🔮
plants * ──── * pestRecords ──── * treatments
sowingBatches 1 ──── * harvests ;  sowingBatches 0..1 ──── plants
tasks *──multiEntry──* plants ;  tasks.seriesId groups recurrences
notes *──multiEntry──* plants
```

**Referential integrity** is enforced by repositories (IndexedDB has no FKs): deleting a plant soft-deletes it and leaves history intact; permanent delete cascades (events, images, thumbnails, analyses) inside one transaction; a periodic integrity check (Settings → Diagnostics) reports orphans.

## 5. Primary Keys & Index Summary

- All primary keys are UUIDv4 strings via `keyPath: "id"` (except `thumbnails` keyed by `imageId`, `appMeta` by `key`, `weatherCache` by `key`, and autoIncrement `sensorReadings`/`oplog`).
- UUIDs (not autoIncrement) everywhere user data lives → records are globally unique across devices, which makes v4.0 sync merges and backup imports collision-free.
- Compound indexes exist for exactly the measured hot queries: `[plantId+occurredAt]` (timeline), `[status+dueAt]` (task inbox), `[plantId+capturedAt]` (growth gallery), `[status+category]` (plant list), `[crop+harvestedAt]` (yield analytics).
- Soft-deleted records are filtered by repositories (`deletedAt !== null`), never by indexes — keeps indexes simple; purge job compacts old tombstones after backup.
- **Indexed boolean-like fields are stored as `0 | 1`** (`notes.pinned`, `oplog.synced`): IndexedDB cannot index boolean values. Non-indexed booleans stay booleans.

## 6. Query Patterns (what the indexes are for)

| Screen | Query | Index |
|---|---|---|
| Plant timeline | events where plantId=X order occurredAt desc, paged | `[plantId+occurredAt]` cursor |
| Task inbox | tasks where status=pending & dueAt ≤ now+7d | `[status+dueAt]` bound cursor |
| Plant list | plants where status=active (+category filter) | `[status+category]` |
| Growth gallery | images where plantId=X order capturedAt | `[plantId+capturedAt]` |
| Season yield | harvests where crop=X & harvestedAt in range | `[crop+harvestedAt]` |
| "What cured mealybugs?" | pestRecords by pestType → treatments by pestRecordId | `pestType`, `pestRecordId` |

## 7. Migration Strategy

1. **Schema version** = IndexedDB `version`, mirrored in `appMeta.schemaVersion` and in this document's header. Current design: **1**.
2. One file per bump in `database/migrations/` (`002_add_x.js` …), registered in an ordered array; `onupgradeneeded` runs all pending migrations sequentially. Migrations are **forward-only** (rollback = restore from the automatic pre-migration backup prompt).
3. Every migration ships with a test: fixture DB at version N → migrate → assert invariants at N+1.
4. **Record-level `schemaVersion`** enables lazy per-record upgrades for shape changes that don't need indexes (repositories upgrade on read/write) — avoids full-table rewrites of 20 years of events.
5. Backup archives embed their schema version; restore into a newer app runs the same migration chain over imported data. Restoring into an *older* app is refused with a clear message.
6. Store creation is cheap → all 🔮 stores are created at v1 so v2.0/v2.5 need **data** seeding, not structural migration. Index additions later are normal migrations.

## 8. Capacity & Performance Notes

- 20-year projection: ~50 plants × ~300 events/plant/year ≈ 300k events ≈ tens of MB — trivial for IndexedDB. Images dominate: ~2,000 photos × ~500 KB (webp re-encode on ingest) ≈ 1 GB → quota monitoring (NFR-3.2), persistent-storage request at first run, and original-size setting for power users.
- All list reads are cursor-paged; no store is ever fully materialized into memory except during backup (which streams per-collection).
- Writes batch into single transactions per user action (bulk watering = one transaction).
