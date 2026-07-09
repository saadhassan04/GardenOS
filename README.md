# GardenOS 🌱

**A lifelong Gardening Operating System — offline-first, AI-ready, built to evolve for 20 years.**

| | |
|---|---|
| **Status** | Documentation & Architecture Phase (pre-v1.0) |
| **Platform** | Progressive Web App (installable on mobile & desktop) |
| **Cost model** | 100% free technologies — no paid backends, databases, or APIs |
| **Primary user** | Home gardener in Karachi, Pakistan (hot, humid, monsoon climate) |
| **License** | MIT — see [LICENSE.md](LICENSE.md) |

---

## 1. Purpose

GardenOS is a complete digital platform for managing a real, living garden across its entire lifetime: every plant, every watering, every fertilization, every repotting, every pest outbreak, every harvest, and every photograph — captured, organized, and analyzed in one place.

It is **not** a demo, a toy, or a throwaway app. It is engineered as an enterprise-quality product that will grow incrementally over many years, from a local offline plant journal (v1.x) into an AI-assisted garden intelligence system (v2.x–v3.x) and eventually a cloud-synchronized, sensor-driven garden digital twin (v4.x–v6.x).

## 2. Goals

1. **Single source of truth** for the entire garden: plants, tasks, images, notes, harvests, treatments, and growth history.
2. **Offline-first forever.** The app must be fully functional with zero network connectivity. Network features (weather, AI, sync) are progressive enhancements — never dependencies.
3. **Zero recurring cost.** Only free, open, standards-based technologies.
4. **Data longevity.** User data must outlive any individual device via robust export, backup, and restore. Formats are open (JSON) and documented.
5. **AI-ready by design.** Data models, schemas, and service interfaces are designed today so that AI vision, disease detection, and advisory features can be added later without re-architecture.
6. **Climate-aware.** All future recommendations account for the Karachi climate profile (heat waves, monsoon humidity, intense sunlight, mild winters).

## 3. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Markup | HTML5 | Universal, permanent, free |
| Styling | CSS3 (custom properties, Grid, Flexbox) | No framework lock-in; full design control |
| Logic | Vanilla JavaScript (ES6+ modules) | Zero dependencies, zero build step required, maximum longevity |
| Primary storage | IndexedDB | Structured, indexed, transactional, large-capacity local database |
| Secondary storage | LocalStorage | Lightweight settings & preferences only |
| Offline runtime | Service Workers | Full offline capability, asset caching, background sync (future) |
| Installability | Web App Manifest | Installable PWA on Android, iOS, Windows, macOS, Linux |
| Weather (future) | Open-Meteo (free, keyless) | Free weather API with no key requirement |
| AI (future) | On-device models (TensorFlow.js / WebGPU) + optional free-tier APIs | Keeps offline-first guarantee |

**Deliberately excluded:** frameworks (React/Vue/etc.), bundlers as a requirement, Firebase, Supabase, any paid or account-gated service. See [ARCHITECTURE.md](ARCHITECTURE.md) §2 and [docs/adr/ADR-0001-technology-stack.md](docs/adr/ADR-0001-technology-stack.md) for the full reasoning.

## 4. Installation

> ⚠️ GardenOS is currently in the documentation/architecture phase. No application code exists yet. The instructions below describe the intended v1.0 workflow.

1. Clone or copy the `GardenOS/` directory to any machine.
2. Serve the directory with any static file server (required for Service Worker registration):
   ```bash
   # Recommended during development (disables HTTP caching of ES modules):
   python3 tests/serve.py 8080
   # Any static server works too:
   npx serve .
   python3 -m http.server 8080
   ```
3. Open `http://localhost:8080` in a modern browser.
4. Use the browser's **"Install App"** / **"Add to Home Screen"** action to install GardenOS as a standalone PWA.
5. All data is stored locally on the device. Use **Settings → Backup** regularly and export backups off-device.

No build step, no package installation, and no account are required to run GardenOS.

## 5. Architecture Overview

GardenOS is a layered, modular, offline-first client application:

```
┌─────────────────────────────────────────────────────┐
│  UI Layer          pages / components / widgets      │
├─────────────────────────────────────────────────────┤
│  Application Layer modules (Plant Manager, Tasks…)   │
├─────────────────────────────────────────────────────┤
│  Business Logic    services (rules, scheduling,      │
│                    analytics, horticulture logic)    │
├─────────────────────────────────────────────────────┤
│  Data Layer        models / database (IndexedDB      │
│                    repositories, migrations)         │
├─────────────────────────────────────────────────────┤
│  Platform Layer    pwa (service worker, manifest),   │
│                    storage, config, utils            │
└─────────────────────────────────────────────────────┘
        Future side-cars: Weather · AI · Cloud Sync · IoT
```

- **Strict downward dependencies:** UI → Modules → Services → Data → Platform. Lower layers never import from higher layers.
- **Repository pattern** isolates IndexedDB behind clean async interfaces, so the storage engine (or a future sync layer) can change without touching business logic.
- **Event-driven module communication** via a lightweight internal event bus — modules never import each other directly.
- **Every future capability (AI, weather, cloud, IoT) plugs in as a service behind an interface defined today** in [API_DESIGN.md](API_DESIGN.md).

Full details, data-flow diagrams, and the reasoning behind every decision: [ARCHITECTURE.md](ARCHITECTURE.md).

## 6. Folder Structure

```
GardenOS/
├── README.md                 ← You are here
├── PROJECT_REQUIREMENTS.md   ← Functional & non-functional requirements
├── ARCHITECTURE.md           ← Complete system architecture
├── ROADMAP.md                ← v1.0 → v6.0 version plan
├── CHANGELOG.md              ← Keep a Changelog format
├── DATABASE.md               ← IndexedDB schema, indexes, migrations
├── FEATURES.md               ← Full categorized feature catalog
├── API_DESIGN.md             ← Interface contracts for all services
├── UI_GUIDELINES.md          ← Design system & accessibility rules
├── CONTRIBUTING.md           ← Engineering standards & workflow
├── LICENSE.md                ← MIT license
├── TODO.md                   ← Prioritized engineering task list
│
├── docs/                     ← Extended documentation & ADRs
│   └── adr/                  ← Architecture Decision Records
├── assets/
│   ├── images/               ← Static app imagery
│   └── icons/                ← App & UI icons (PWA icon set)
├── styles/                   ← CSS (tokens, base, layout, components, themes)
├── scripts/                  ← App bootstrap & entry-point scripts
├── components/               ← Reusable UI components (cards, forms, dialogs…)
├── pages/                    ← Top-level screens (Dashboard, Plants, Tasks…)
├── models/                   ← Data model definitions & validation
├── services/                 ← Business logic (plants, tasks, analytics, weather…)
├── database/                 ← IndexedDB wrapper, repositories, migrations, seed
├── utils/                    ← Pure utility functions (dates, ids, formatting…)
├── config/                   ← App constants, feature flags, climate profile
├── storage/                  ← LocalStorage abstraction (settings/preferences)
├── hooks/                    ← Reusable stateful behaviors (observers, routing…)
├── widgets/                  ← Dashboard widgets (weather, due tasks, stats…)
├── modules/                  ← Feature modules composing pages+services
├── pwa/                      ← manifest.json, service worker, offline shell
├── tests/                    ← Unit & integration tests
├── backups/                  ← Local backup archive drop zone
├── export/                   ← Generated export artifacts
└── import/                   ← Staging area for data imports
```

Responsibilities of every folder are specified in [ARCHITECTURE.md](ARCHITECTURE.md) §4.

## 7. Roadmap (Summary)

| Version | Theme |
|---|---|
| **v1.0** | Foundation — PWA shell, database core, navigation, settings, backup/restore |
| **v1.1** | Plant Manager — full plant CRUD, care profiles, plant timeline |
| **v1.2** | Image Manager — photo capture, galleries, growth photo timeline |
| **v1.3** | Kitchen Garden — vegetables, sowing-to-harvest lifecycle, yield logs |
| **v1.4** | Garden Dashboard — widgets, statistics, at-a-glance garden health |
| **v1.5** | Task Scheduler — recurring care tasks, reminders, care calendar |
| **v2.0** | AI Vision — plant ID & disease detection from photos |
| **v2.5** | Weather Intelligence — Karachi forecasts driving care advice |
| **v3.0** | Garden AI — plant doctor, fertilizer advisor, AI chat assistant |
| **v4.0** | Cloud Synchronization — optional multi-device sync (free tier only) |
| **v5.0** | IoT Sensors — soil moisture, light, temperature integration |
| **v6.0** | Garden Digital Twin — full virtual garden model & simulation |

Detailed milestones and acceptance gates: [ROADMAP.md](ROADMAP.md).

## 8. Future Vision

Twenty years from now, GardenOS should hold the complete life story of a garden: thousands of photographs organized into growth timelines, a decade of harvest analytics, a searchable history of every pest outbreak and what cured it, AI that recognizes each individual plant and its condition, sensors reporting soil moisture in real time, and a digital twin that can simulate "what happens if I move the bougainvillea to the east wall?"

Every architectural decision made today is made in service of that horizon — which is why data formats are open, storage is local-first, interfaces are contracts, and nothing is coupled to a vendor that might not exist in 2046.

---

*Maintained per the standards in [CONTRIBUTING.md](CONTRIBUTING.md). All changes recorded in [CHANGELOG.md](CHANGELOG.md).*
