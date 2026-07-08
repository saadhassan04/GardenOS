# GardenOS — Project Requirements Specification

**Document status:** Living document · v1.0 · 2026-07-09
**Scope:** All requirements for GardenOS v1.x, with forward-looking requirements for v2.0+ marked accordingly.

---

## 1. Product Definition

GardenOS is an offline-first Progressive Web App that serves as the permanent digital management system for a home garden. It manages plants of all categories (flowers, indoor, outdoor, trees, vegetables, seedlings, propagation), their complete care history, images, tasks, harvests, pest treatments, and notes — with a roadmap toward AI vision, weather intelligence, cloud sync, and IoT integration.

### 1.1 Primary User Profile

- Home gardener in **Karachi, Pakistan**.
- Manages **35+ plants** across ornamentals (plumeria, bougainvillea, rose, jasmine, motia), foliage/indoor (ferns, palms, snake plants, money plants, dracaena, dieffenbachia), edibles (curry leaf, lemon, mint), and a seasonal kitchen garden (tomatoes, okra, chilies, gourds, brassicas, leafy greens).
- Uses the app primarily on a **mobile phone in the garden** (sunlight, wet hands) and secondarily on desktop for review/analytics.
- May have **no internet connection** while gardening.

### 1.2 Climate Context (drives future advisory features)

| Factor | Karachi profile | Product implication |
|---|---|---|
| Summer | Extremely hot (35–45 °C), heat waves | Heat-stress warnings, adjusted watering frequency |
| Humidity | High, especially June–September | Fungal disease risk models |
| Monsoon | July–September heavy rain events | Rain-aware watering suppression, drainage alerts |
| Sunlight | Intense year-round | Sun-exposure tracking per plant location |
| Winter | Mild (10–25 °C), rarely frost | Winter sowing calendar for kitchen garden |
| Cloudy periods | Common in monsoon | Light-level considerations for indoor plants |

---

## 2. Functional Requirements

Requirements use RFC-2119 keywords (MUST / SHOULD / MAY). IDs are stable and referenced from TODO.md and test plans.

### FR-1 Plant Management (v1.1)

- **FR-1.1** The system MUST support unlimited plant records.
- **FR-1.2** Each plant MUST support: name, botanical name, category (flower / indoor / outdoor / tree / vegetable / herb / seedling / propagation), acquisition date, location in garden, container type & size, soil mix, sun exposure, status (active / dormant / archived / deceased), and free-form notes.
- **FR-1.3** Each plant MUST have a care profile: watering frequency, fertilizing schedule, pruning needs, repotting interval — all user-editable.
- **FR-1.4** Plants MUST be searchable, filterable (category, location, status), and sortable (name, date added, last watered).
- **FR-1.5** Archiving/deleting a plant MUST preserve its history unless the user explicitly performs a permanent delete with confirmation.
- **FR-1.6** The system MUST support propagation lineage: a plant MAY reference a parent plant (e.g., plumeria cutting from Black Plumeria).

### FR-2 Plant Timeline (v1.1)

- **FR-2.1** Every plant MUST have a chronological timeline aggregating all events: waterings, fertilizations, repottings, prunings, deadheadings, treatments, harvests, photos, and notes.
- **FR-2.2** Timeline entries MUST be added in ≤ 3 taps from the plant detail screen (fast field entry).
- **FR-2.3** Timeline entries MUST support backdating (logging yesterday's watering today).

### FR-3 Care Event Logging (v1.1, v1.5)

- **FR-3.1** The system MUST support these care event types at minimum: watering, fertilizing (with product & dose), repotting (with pot size & soil mix), pruning, deadheading, pest observation, treatment application (with product & dose), harvest (with quantity & unit), general observation.
- **FR-3.2** Care events MUST be loggable for a single plant or in bulk for multiple plants at once ("watered all balcony plants").
- **FR-3.3** Event types MUST be extensible via configuration without schema redesign.

### FR-4 Task Management (v1.5)

- **FR-4.1** The system MUST support one-off and recurring tasks (daily / every N days / weekly / monthly / seasonal).
- **FR-4.2** Tasks MUST be linkable to specific plants or garden areas, or be general.
- **FR-4.3** The system MUST show overdue, due-today, and upcoming tasks distinctly.
- **FR-4.4** Completing a task that represents a care action MUST offer to log the corresponding care event automatically.
- **FR-4.5** The system SHOULD support local notifications where the platform permits (PWA notification API), degrading gracefully where not.

### FR-5 Kitchen Garden (v1.3)

- **FR-5.1** The system MUST model the vegetable lifecycle: seed → sown → germinated → transplanted → flowering → fruiting → harvesting → finished.
- **FR-5.2** The system MUST record sowing batches (crop, variety, quantity, date, tray/bed location).
- **FR-5.3** The system MUST record harvests with quantity, unit, and date, aggregated per crop and per season.
- **FR-5.4** The system SHOULD provide a Karachi-appropriate sowing calendar (data-driven, stored locally, editable).

### FR-6 Image Management (v1.2)

- **FR-6.1** The system MUST capture photos via device camera or file upload and store them locally (IndexedDB Blob storage).
- **FR-6.2** Images MUST be attachable to plants, timeline events, notes, and pest/treatment records.
- **FR-6.3** The system MUST generate and store thumbnails for gallery performance.
- **FR-6.4** The system MUST provide a per-plant growth gallery in chronological order (growth timeline view).
- **FR-6.5** The system MUST warn the user about storage usage and MUST include images in backup/export.

### FR-7 Garden Notes (v1.1)

- **FR-7.1** The system MUST support free-form notes with title, body, optional plant links, optional images, and tags.
- **FR-7.2** Notes MUST be full-text searchable (client-side index).

### FR-8 Dashboard (v1.4)

- **FR-8.1** The dashboard MUST show: tasks due today/overdue, recently active plants, garden statistics (plant counts by category/status), recent photos, and recent harvests.
- **FR-8.2** Dashboard widgets MUST be modular — individually toggleable and reorderable (widget registry pattern).

### FR-9 Settings, Backup, Restore, Import, Export (v1.0)

- **FR-9.1** The system MUST export the complete database (including images) to a single versioned JSON+binary archive file downloadable by the user.
- **FR-9.2** The system MUST restore from such an archive, with schema-version validation and a pre-restore safety snapshot.
- **FR-9.3** The system MUST support selective export (e.g., plants only, CSV of harvests).
- **FR-9.4** The system SHOULD remind the user to back up after N days without a backup (configurable).
- **FR-9.5** Settings MUST include: theme (dark/light/auto), measurement units, start-of-week, backup reminders, feature flags.

### FR-10 Pest & Disease Records (v1.1)

- **FR-10.1** The system MUST log pest/disease observations (type, severity, affected plants, photos).
- **FR-10.2** The system MUST log treatments (product, dose, method, date) linked to observations, and their outcomes.
- **FR-10.3** Treatment history MUST be queryable per plant and per pest type ("what cured mealybugs last time?").

### FR-11 Future Functional Requirements (v2.0+, design-constraining today)

- **FR-11.1 (v2.0)** AI Vision: identify plants and detect diseases from photos. → Images must retain EXIF/date metadata; image records need an `analysis` extension point.
- **FR-11.2 (v2.5)** Weather Intelligence: fetch Karachi forecasts (free keyless API), cache offline, drive care suggestions. → Weather service interface defined now in API_DESIGN.md.
- **FR-11.3 (v3.0)** Garden AI: plant doctor Q&A, fertilizer advisor, watering prediction. → Care history must be stored in structured, machine-readable form (it is).
- **FR-11.4 (v4.0)** Cloud Sync: optional, free-tier, end-to-end-encrypted multi-device sync. → All records carry `id` (UUID), `createdAt`, `updatedAt`, `deletedAt` (soft delete) from v1.0 to enable conflict resolution later.
- **FR-11.5 (v5.0)** IoT: ingest sensor readings (soil moisture, temperature, light). → `sensorReadings` collection reserved in schema.
- **FR-11.6 (v6.0)** Digital Twin: spatial garden model. → Plants carry a structured `location` object from v1.0.

---

## 3. Non-Functional Requirements

### NFR-1 Offline Capability

- **NFR-1.1** 100% of v1.x features MUST work with no network connection.
- **NFR-1.2** The service worker MUST precache the full app shell; a fresh install MUST work offline after first load.
- **NFR-1.3** Network-dependent features (v2.5+) MUST degrade gracefully with cached data and clear staleness indicators.

### NFR-2 Performance

- **NFR-2.1** First contentful paint < 1.5 s on a mid-range Android phone (repeat visits < 0.5 s via SW cache).
- **NFR-2.2** All list views MUST remain smooth (no blocking > 50 ms) with 1,000+ plants and 10,000+ events — achieved via IndexedDB indexes, pagination/virtualization, and thumbnail usage.
- **NFR-2.3** Photo capture-to-saved MUST complete < 2 s including thumbnail generation.
- **NFR-2.4** Lighthouse PWA score MUST be ≥ 90 at every release.

### NFR-3 Scalability

- **NFR-3.1** Data model MUST handle unlimited plants and 20 years of events (≈ 100k+ records) without redesign.
- **NFR-3.2** Storage strategy MUST monitor and report IndexedDB quota usage; the app MUST request persistent storage (`navigator.storage.persist()`).

### NFR-4 Reliability & Data Safety

- **NFR-4.1** All multi-record operations MUST use IndexedDB transactions (atomicity).
- **NFR-4.2** Schema migrations MUST be versioned, forward-only, and tested; a failed migration MUST NOT corrupt existing data.
- **NFR-4.3** Deletes are soft by default; permanent deletion requires explicit confirmation.
- **NFR-4.4** Restore MUST validate archive integrity (checksum + schema version) before touching live data.

### NFR-5 Maintainability & Code Quality

- **NFR-5.1** SOLID, DRY, KISS, YAGNI. Modules communicate via events/interfaces, never direct cross-imports.
- **NFR-5.2** Zero runtime dependencies in v1.x. Any future dependency requires an ADR.
- **NFR-5.3** Every public function documented with JSDoc; every module has a header comment stating its responsibility.
- **NFR-5.4** Consistent formatting and naming per CONTRIBUTING.md; all changes logged in CHANGELOG.md.

### NFR-6 Usability & Accessibility

- **NFR-6.1** Mobile-first, one-handed operation for common logging actions.
- **NFR-6.2** WCAG 2.1 AA: contrast ratios, focus states, semantic HTML, screen-reader labels.
- **NFR-6.3** Dark theme as default (outdoor OLED battery + evening use), light theme available.
- **NFR-6.4** Touch targets ≥ 44×44 px; critical actions reachable within thumb zone.

### NFR-7 Security & Privacy

- **NFR-7.1** All data stays on-device in v1.x. No telemetry, no analytics beacons, no third-party requests.
- **NFR-7.2** Future sync (v4.0) MUST be opt-in and end-to-end encrypted.
- **NFR-7.3** Exports contain personal data; UI MUST convey that backup files should be stored safely.

### NFR-8 Compatibility

- **NFR-8.1** Support evergreen Chrome/Edge/Firefox and Safari ≥ 16.4 (IndexedDB + SW + manifest baseline).
- **NFR-8.2** Responsive from 320 px phones to 4K desktops.

---

## 4. User Stories & Acceptance Criteria

### Epic A — Plant Care (v1.1)

**US-A1** — *As a gardener, I want to add each of my plants with its details so my whole collection lives in one system.*
- ✅ Can create a plant with only a name (everything else optional, editable later).
- ✅ Can assign category, location, container, and care profile.
- ✅ New plant appears in list, search, and dashboard counts immediately.

**US-A2** — *As a gardener, I want to log watering for several plants at once because I water the whole balcony together.*
- ✅ Multi-select plants → one action logs watering for all, timestamped.
- ✅ Each plant's timeline shows the event; "last watered" updates everywhere.

**US-A3** — *As a gardener, I want to see everything that ever happened to my Black Plumeria on one timeline.*
- ✅ Timeline shows all event types interleaved chronologically with icons and dates.
- ✅ Filter by event type; infinite scroll for long histories.

### Epic B — Kitchen Garden (v1.3)

**US-B1** — *As a kitchen gardener, I want to track my tomato batch from sowing to final harvest so I know my true yield.*
- ✅ Sowing batch created with date/quantity; stage transitions recorded with dates.
- ✅ Multiple harvest entries accumulate into a per-crop season total.

**US-B2** — *As a Karachi gardener, I want to know what to sow this month.*
- ✅ Sowing calendar shows month-appropriate crops for the Karachi profile; editable.

### Epic C — Images (v1.2)

**US-C1** — *As a gardener, I want to photograph my plants over time and watch them grow.*
- ✅ Capture from camera or gallery; photo attaches to plant with date.
- ✅ Growth view shows the plant's photos as a swipeable chronological strip.
- ✅ Works fully offline; images included in backups.

### Epic D — Tasks (v1.5)

**US-D1** — *As a gardener, I want recurring reminders (fertilize roses monthly) so nothing is forgotten.*
- ✅ Recurring task auto-regenerates on completion; overdue tasks visibly flagged.
- ✅ Completing "water" task offers one-tap care-event logging.

### Epic E — Data Safety (v1.0)

**US-E1** — *As a long-term user, I want a full backup I can restore on a new phone.*
- ✅ One-tap export produces a single archive; restore on a fresh install reproduces the full garden, images included.
- ✅ Restore refuses corrupt/incompatible archives with a clear message and leaves existing data untouched.

### Epic F — Future (v2.0+, recorded for design pressure)

**US-F1** *(v2.0)* — Photograph a sick leaf → AI suggests likely disease + treatment.
**US-F2** *(v2.5)* — Heat wave forecast → app suggests moving sensitive plants to shade and increasing watering.
**US-F3** *(v3.0)* — Ask "why are my chili leaves curling?" → AI answers using my plant's actual history.
**US-F4** *(v4.0)* — Same garden data on phone and desktop, synced automatically.

---

## 5. Out of Scope (explicitly)

- Multi-user / social features (single-gardener product).
- Paid services, ads, accounts, or any server requirement for core function.
- Native app store distribution (PWA only).
- E-commerce / plant shopping integrations.

## 6. Traceability

| Requirement group | Design doc | Delivery version |
|---|---|---|
| FR-9 (backup/restore/settings) | ARCHITECTURE.md §6, API_DESIGN.md §7–8 | v1.0 |
| FR-1, FR-2, FR-7, FR-10 | DATABASE.md, ARCHITECTURE.md §5 | v1.1 |
| FR-6 | DATABASE.md `images`, API_DESIGN.md §5 | v1.2 |
| FR-5 | DATABASE.md `sowingBatches`/`harvests` | v1.3 |
| FR-8 | ARCHITECTURE.md widgets, UI_GUIDELINES.md | v1.4 |
| FR-4 | DATABASE.md `tasks`, API_DESIGN.md §6 | v1.5 |
| FR-11.x | API_DESIGN.md §3–4, §9–11 | v2.0–v6.0 |
