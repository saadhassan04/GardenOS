# GardenOS — Feature Catalog

**Document status:** Living document · 2026-07-09
**Legend:** 📋 Planned · 🔨 In development · ✅ Shipped · 🧪 Experimental · Version = delivery target per [ROADMAP.md](ROADMAP.md)

This is the complete inventory of every feature GardenOS will offer. Status flips are made here at each release (see CONTRIBUTING.md release checklist).

---

## 1. Current Features (v1.x core — all 📋 until implementation begins)

### 1.1 Foundation & Platform (v1.0)
| Feature | Status | Notes |
|---|---|---|
| Installable PWA (Android/iOS/desktop) | 📋 | Manifest + SW + icon set |
| Full offline operation | 📋 | App-shell precache; core never needs network |
| Dark / light / auto theme | 📋 | Dark default (UI_GUIDELINES.md) |
| Responsive mobile-first UI | 📋 | 320 px → 4K |
| Hash-based SPA navigation | 📋 | No page reloads |
| Settings (units, week start, theme, flags) | 📋 | LocalStorage-backed |
| Storage usage monitor + persistent storage request | 📋 | Quota warnings at 70/90% |
| Diagnostics view (error log, integrity check) | 📋 | Local-only |
| In-app update prompt (new SW available) | 📋 | Never silent-reloads |

### 1.2 Data Safety (v1.0)
| Feature | Status | Notes |
|---|---|---|
| Full backup archive (all data + images) | 📋 | Single file, checksummed, versioned |
| Restore with validation + pre-restore snapshot | 📋 | Release-gating round-trip test |
| Selective export (plants / harvests / notes; JSON & CSV) | 📋 | |
| Import with merge/replace modes | 📋 | UUID-safe |
| Backup reminders | 📋 | After N days, configurable |

### 1.3 Plant Manager (v1.1)
| Feature | Status | Notes |
|---|---|---|
| Unlimited plants, all categories | 📋 | flowers, indoor, outdoor, trees, vegetables, herbs, seedlings, propagation |
| Plant profiles (botanical name, location, container, soil, sun) | 📋 | Only name is mandatory |
| Care profiles + per-plant overrides | 📋 | Karachi-tuned seed presets |
| Propagation lineage (parent → cuttings) | 📋 | |
| Search / filter / sort | 📋 | Status, category, location |
| Soft archive & restore; confirmed permanent delete | 📋 | History preserved |
| Care event logging (water, fertilize, repot, prune, deadhead, treat, observe) | 📋 | Single + bulk, backdatable |
| Plant timeline (unified chronological history) | 📋 | Filterable, paginated |
| Garden notes (tags, plant links, search, pin) | 📋 | |
| Pest observation records (severity, status, photos) | 📋 | |
| Treatment log with outcomes | 📋 | "What worked last time" queries |
| Garden locations/areas management | 📋 | |

### 1.4 Image Manager (v1.2)
| Feature | Status | Notes |
|---|---|---|
| Camera & file photo capture (offline) | 📋 | WebP re-encode on ingest |
| Auto thumbnails | 📋 | Galleries never load full blobs |
| Attach photos to plants / events / notes / pests | 📋 | |
| Per-plant growth gallery (chronological) | 📋 | Swipeable strip |
| All-photos gallery with filters | 📋 | |
| Cover image per plant | 📋 | |
| Images in backup/restore | 📋 | |

### 1.5 Kitchen Garden (v1.3)
| Feature | Status | Notes |
|---|---|---|
| Sowing batches with lifecycle stages | 📋 | seed → … → finished |
| Stage-change tracking with dates | 📋 | Event-sourced |
| Harvest logging (qty, unit, quality) | 📋 | |
| Per-crop & per-season yield totals | 📋 | |
| Karachi sowing calendar (editable seed data) | 📋 | Winter season focus |
| Kitchen garden overview (active crops, day counters) | 📋 | |

### 1.6 Dashboard (v1.4)
| Feature | Status | Notes |
|---|---|---|
| Widget-based dashboard (toggle/reorder) | 📋 | Widget registry |
| Due & overdue tasks widget | 📋 | |
| Garden statistics widget | 📋 | Counts by category/status |
| Recent photos widget | 📋 | |
| Recent harvests widget | 📋 | |
| "Needs attention" widget | 📋 | Care profile vs. actual history |
| Quick-log shortcuts | 📋 | One-tap watering etc. |
| Basic charts (watering frequency, harvest totals) | 📋 | Canvas, no libraries |

### 1.7 Task Scheduler (v1.5)
| Feature | Status | Notes |
|---|---|---|
| One-off & recurring tasks | 📋 | daily / N-days / weekly / monthly / seasonal |
| Plant- and area-linked tasks | 📋 | |
| Care calendar (month/week views) | 📋 | |
| Overdue escalation | 📋 | |
| Complete-task → auto-log care event | 📋 | |
| Local notifications (where supported) | 📋 | Graceful fallback |
| Care-profile-driven task suggestions | 📋 | |

---

## 2. Future Features

### 2.1 AI Features (v2.0 / v3.0)
| Feature | Version | Notes |
|---|---|---|
| Plant identification from photo | v2.0 | On-device model first |
| Disease & pest detection from photo | v2.0 | Plumeria rust, mealybug, leaf spot = acid tests |
| Plant health scoring over time | v2.0 🧪 | From photo series |
| User confirm/correct on AI results | v2.0 | Corrections stored |
| Plant Doctor (symptom Q&A on real history) | v3.0 | |
| Fertilizer Advisor | v3.0 | History + species + season |
| Automatic watering prediction | v3.0 | Events + weather + climate profile |
| AI Chat Assistant over own garden data | v3.0 | |
| Garden Knowledge Base (local, Karachi-aware) | v3.0 | |

### 2.2 Weather Intelligence (v2.5)
| Feature | Version | Notes |
|---|---|---|
| Karachi forecast (free keyless API, cached offline) | v2.5 | Open-Meteo |
| Weather dashboard widget | v2.5 | |
| Heat-wave alerts + care suggestions | v2.5 | |
| Monsoon / heavy-rain watering suppression | v2.5 | |
| Seasonal context on plant pages | v2.5 | |

### 2.3 Analytics Features (v1.4 → v3.0, growing)
| Feature | Version | Notes |
|---|---|---|
| Watering/fertilizing frequency charts | v1.4 | |
| Harvest yield analytics (crop, season, YoY) | v1.4→ | |
| Pest outbreak history & treatment efficacy | v2.5 🧪 | |
| Plant growth timelines from photo series | v2.0 🧪 | |
| Garden health index | v3.0 🧪 | Composite score |
| Care cost/effort analytics | v3.0 🧪 | |

### 2.4 Cloud & Sync (v4.0)
| Feature | Version | Notes |
|---|---|---|
| Opt-in multi-device sync (E2E-encrypted, free-tier) | v4.0 | Repository decorator + oplog |
| Conflict resolution (LWW + append-only events) | v4.0 | |
| Sync status & audit view | v4.0 | |

### 2.5 IoT & Digital Twin (v5.0 / v6.0)
| Feature | Version | Notes |
|---|---|---|
| Soil moisture / temp / light sensor ingestion | v5.0 | Web Bluetooth / Serial / local HTTP |
| Sensor charts on plant pages | v5.0 | |
| Sensor-driven watering suggestions | v5.0 | |
| Visual garden map (spatial model) | v6.0 | |
| Sun-path modeling (Karachi latitude) | v6.0 🧪 | |
| Placement & season simulation ("what if") | v6.0 🧪 | |
| Growth projection from historical data | v6.0 🧪 | |

### 2.6 Voice (v3.0+ 🧪)
| Feature | Version | Notes |
|---|---|---|
| Voice logging ("watered the roses") | v3.0+ 🧪 | Web Speech API, free, on-device where possible |
| Voice queries to assistant | v3.0+ 🧪 | |

---

## 3. Experimental Ideas (parked — need ADR before promotion)
- Companion-planting advisor for the kitchen garden.
- QR plant tags (print label → scan → open plant page).
- Lunar/traditional sowing calendar overlay.
- Time-lapse video generation from growth galleries.
- Shareable read-only garden snapshot (static export).

## 4. Explicit Non-Features
Multi-user accounts · social feeds · ads · telemetry · paid tiers · server-required core functionality. See PROJECT_REQUIREMENTS.md §5.
