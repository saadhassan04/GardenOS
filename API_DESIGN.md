# GardenOS — API & Service Interface Design

**Document status:** Living document · 2026-07-09
**Nature:** Interface contracts only — no implementation. These signatures are the *design commitment*; implementations arrive per ROADMAP.md and must conform or amend this document via ADR.

GardenOS has no server of its own. "APIs" here means:
1. **Internal service interfaces** — the contracts between layers (the app's real API surface).
2. **External provider contracts** — how free third-party APIs (weather) and platform APIs (camera, notifications) are wrapped so they remain swappable.

**Conventions:** All methods are `async` unless noted · errors are typed (`GardenOSError` subclasses: `ValidationError`, `NotFoundError`, `StorageError`, `NetworkError`, `MigrationError`) · all timestamps ISO-8601 UTC · all ids UUIDv4 · list methods accept `{limit, cursor}` and return `{items, nextCursor}`.

---

## 1. Repository Contract (Data Layer — v1.0)

Every collection repository implements `IRepository<T>`; specializations add indexed queries.

```js
interface IRepository<T> {
  get(id): Promise<T | null>
  getMany(ids): Promise<T[]>
  add(record): Promise<T>                    // stamps envelope (id, createdAt…)
  addMany(records): Promise<T[]>             // single transaction
  update(id, patch): Promise<T>              // stamps updatedAt
  softDelete(id): Promise<void>              // sets deletedAt
  hardDelete(id): Promise<void>              // cascades, transactional
  query({index, range, direction, limit, cursor}): Promise<Page<T>>
  count(filter?): Promise<number>
  exportAll(onBatch): Promise<void>          // cursor-streamed for backup
  importBatch(records, {mode: "merge"|"replace"}): Promise<ImportStats>
}

// Specialization examples (implemented in database/):
EventRepository.getTimeline(plantId, {types?, limit, cursor})   // [plantId+occurredAt]
TaskRepository.getDue(beforeISO)                                // [status+dueAt]
ImageRepository.getGrowthSeries(plantId, {limit, cursor})       // [plantId+capturedAt]
HarvestRepository.getSeasonTotals(crop, {from, to})             // [crop+harvestedAt]
```

## 2. Core Domain Services (Business Layer — v1.1–v1.5)

```js
PlantService:
  createPlant(input) / updatePlant(id, patch) / archivePlant(id) / deletePlantPermanently(id)
  getPlantWithSummary(id)            // plant + derived + due tasks + latest photo
  listPlants({status, category, locationId, search, sort, cursor})
  getLineage(id)                     // propagation ancestors + descendants

CareEventService:
  log(plantId, type, {occurredAt?, data?, imageIds?})
  logBulk(plantIds, type, {...})     // one transaction + one batchId
  getTimeline(plantId, {types?, cursor})
  undoBatch(batchId)                 // within grace period

TaskSchedulerService:
  createTask(input) / updateTask(id, patch) / deleteTask(id)
  completeTask(id, {logCareEvent: boolean})   // FR-4.4
  skipOccurrence(id)
  getInbox()                         // {overdue, dueToday, upcoming}
  getCalendar(month)
  suggestFromCareProfiles()          // "rose fertilizing due — create task?"

KitchenGardenService:
  createBatch(input) / advanceStage(batchId, stage, {at})
  logHarvest(batchId | plantId, {quantity, unit, quality})
  getActiveCrops() / getYield({crop?, season?})
  getSowingCalendar(month)           // Karachi seed data, user-editable

NotesService:      create/update/softDelete/search(text)/listByPlant(plantId)/listByTag(tag)
PestService:       observe(input) / resolve(id) / listActive() / getTreatmentHistory(pestType)
TreatmentService:  apply(input) / recordOutcome(id, outcome) / whatWorkedFor(pestType)
AnalyticsService:  wateringFrequency({plantId?, range}) / harvestTotals({crop?, season?})
                   careActivityHeatmap(range) / gardenStats()
```

## 3. Weather API (v2.5 — contract fixed now)

```js
interface IWeatherProvider {                    // implemented by OpenMeteoProvider first
  getCurrent(coords): Promise<WeatherSnapshot>
  getForecast(coords, days): Promise<DailyForecast[]>
  getHistory(coords, {from, to}): Promise<DailyRecord[]>   // if provider supports
}

WeatherSnapshot  = { at, tempC, humidityPct, precipitationMm, windKph, uvIndex, condition, isStale }
DailyForecast    = { date, tempMinC, tempMaxC, humidityPct, precipitationMm,
                     precipitationProbPct, uvIndex, condition }

WeatherService (consumer-facing — the ONLY thing the app talks to):
  getToday() / getWeek()                        // cache-first, TTL, isStale flagged
  getAlerts(): Promise<WeatherAlert[]>          // {type: "heatWave"|"heavyRain"|"highHumidity",
                                                //  severity, from, to, advice}
  // Alert thresholds come from config/climate.karachi.js, not hardcoded.
```

Rules: cache in `weatherCache` store · never block UI on network · provider swap = config change · no API keys ever required for the default provider.

## 4. AI APIs (v2.0 / v3.0 — contracts fixed now)

```js
interface IPlantIdentifier {                     // v2.0
  identify(imageBlob): Promise<{candidates: [{species, commonName, confidence}], provider}>
}
interface IDiseaseDetector {                     // v2.0
  analyze(imageBlob, {plantContext?}): Promise<{
    findings: [{condition, confidence, affectedArea?, description}],
    healthScore?: number, provider }>
}
interface IGardenAdvisor {                       // v3.0
  ask(question, context): Promise<{answer, sources: [], confidence}>
  // context = {plant?, recentEvents?, weather?, climateProfile} — assembled by the app,
  // so any backend (local model or free-tier remote) answers from the SAME grounding.
  adviseWatering(plantId): Promise<{nextWaterAt, rationale}>
  adviseFertilizer(plantId): Promise<{recommendation, product?, timing, rationale}>
}

AIVisionService (consumer-facing):
  identifyPlant(imageId) / detectDisease(imageId, plantId?)
  // Persists an `analyses` record; emits 'analysis:completed' on the bus.
  recordVerdict(analysisId, "confirmed" | {correction})     // training signal
```

Rules: on-device providers preferred (offline-first) · every result stores `provider` + `confidence` · AI never mutates domain records — it only appends `analyses` and *suggests* actions the user confirms.

## 5. Image API (v1.2)

```js
ImageService:
  ingest(fileOrBlob, {plantId?, eventId?, noteId?, capturedAt?})
    // → re-encode webp, extract date, generate thumbnail, single transaction
    // → {imageId, thumbnailId, byteSize}
  getThumbnailURL(imageId) / getFullURL(imageId)   // object URLs, caller-released
  getGrowthSeries(plantId, {cursor})
  setCover(plantId, imageId)
  remove(imageId)                                   // cascades thumbnail + analysis
  getStorageBreakdown()                             // per-plant bytes for quota UI
```

## 6. Notification API (v1.5)

```js
NotificationService:
  getCapability(): "granted" | "denied" | "unsupported" | "not-asked"
  requestPermission()
  scheduleForTask(task) / cancelForTask(taskId)     // best-effort per platform
  getFallbackInbox()                                // badge counts when notifications unavailable
```

## 7. Import / Export API (v1.0)

```js
ExportService:
  exportFull(): Promise<ArchiveBlob>                // everything + images, checksummed
  exportCollection(name, format: "json"|"csv")
  exportPlantReport(plantId)                        // single plant + history + photos

ImportService:
  inspect(file): Promise<{app, schemaVersion, counts, checksumOk}>   // validate BEFORE touching data
  importArchive(file, {mode: "merge"|"replace"}): Promise<ImportReport>
  importCSV(file, {collection, mapping}): Promise<ImportReport>

Archive format (versioned, documented, open):
{ meta: {app: "GardenOS", appVersion, schemaVersion, createdAt, checksum: "sha-256", counts: {…}},
  collections: { plants: […], events: […], … },
  images: [{record, blobBase64}] }                  // or bundled binary container
```

## 8. Backup / Restore API (v1.0)

```js
BackupService:
  createBackup(): Promise<{file, meta}>             // ExportService.exportFull + appMeta history entry
  restore(file, {preflightSnapshot: true}): Promise<RestoreReport>
    // pipeline: inspect → checksum → schemaVersion gate → snapshot current DB →
    //           transactional import → verify counts → commit | rollback to snapshot
  getBackupStatus()                                 // lastBackupAt, daysSince, reminder due?
```

## 9. Sync API (v4.0 — reserved)

```js
interface ISyncTransport {                          // free-tier object storage / user-owned endpoint
  push(encryptedOps): Promise<{accepted}>
  pull(sinceToken): Promise<{ops, nextToken}>
}
SyncService: enable({passphrase}) / disable() / syncNow() / getStatus()
// E2E: keys derived from passphrase, never leave device. Engine = SyncedRepository
// decorator + oplog (ARCHITECTURE.md §10). Core app functions identically with sync off.
```

## 10. Sensor API (v5.0 — reserved)

```js
interface ISensorAdapter {                          // WebBluetoothAdapter | WebSerialAdapter | LocalHttpAdapter
  discover() / connect(sensorId) / readOnce(sensorId)
  subscribe(sensorId, onReading)                    // → SensorService.ingest → sensorReadings store
}
SensorService: listSensors() / bind(sensorId, {plantId | locationId})
               getSeries(plantId, metric, range) / getLatest(plantId)
```

## 11. Event Bus Topics (internal API — v1.0)

Stable, namespaced, documented here before use:

```
plant:created|updated|archived|deleted        events:logged (payload incl. batchId)
task:created|completed|overdue                image:added|removed
harvest:logged                                 batch:stage-changed
pest:observed|resolved                         treatment:applied|outcome
backup:created|restored                        storage:quota-warning
weather:updated|alert          (v2.5)          analysis:completed        (v2.0)
sync:status                    (v4.0)          sensor:reading            (v5.0)
```

Payloads carry ids, not full records — consumers fetch what they need. Topics are append-only: renaming/removing a topic requires an ADR.
