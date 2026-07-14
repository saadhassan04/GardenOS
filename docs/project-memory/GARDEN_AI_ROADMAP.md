# GardenOS — Garden AI Roadmap

**Planning only. Do not implement from this document.** The first AI feature requires an ADR (it will be the project's first runtime dependency). This roadmap describes the long-term intelligence vision and the guardrails around it.

## Guiding principles for all Garden AI
- **On-device first.** Preserve offline-first and zero-cost; prefer models that run in the browser (TensorFlow.js / transformers.js / WebGPU). Remote free-tier providers are optional, pluggable alternates behind an interface — never a requirement.
- **AI suggests, the user confirms.** Every AI output is a proposal; the user accepts/corrects; corrections are stored as future training signal.
- **Grounded in the garden's own data.** AI reads the same event-sourced history, images, care profiles, and Karachi climate profile the rest of the app uses. Results are written back as first-class `analyses` records (store reserved at schema v1) with `provider` + `confidence`.
- **Explainable.** Every recommendation states its reasoning and its inputs.
- **Interface-first.** Contracts already sketched in root `API_DESIGN.md` (§4): `IPlantIdentifier`, `IDiseaseDetector`, `IGardenAdvisor`, `IWeatherProvider`.

---

## Plant Vision (v2.0)
Identify plants from photos; detect disease/pest/health from leaf images. On-device classification first; the manual human-in-the-loop photo audit already performed (Claude vision, 2026-07-12) is the conceptual prototype. Acid tests for Karachi: plumeria rust, mealybug, fungal leaf spot.

## Disease Detection (v2.0)
Leaf-image classifier surfacing likely conditions with confidence + suggested treatments drawn from the local knowledge base and the plant's own treatment history ("what worked last time"). Writes an `analyses` record linked to the image.

## Image Intelligence (v2.0+)
Growth tracking from the per-plant photo series (size/greenness over time), auto-tagging (flower/fruit/bud presence → could auto-suggest flowering/fruiting milestone events), and health-trend scoring from image sequences.

## Weather Intelligence (v2.5)
Open-Meteo (free, keyless) for Karachi, cached offline in `weatherCache` (reserved store). Heat-wave and monsoon alerts from `config/climate.karachi.js` thresholds; rain-aware watering suppression on tasks; seasonal context on plant pages. Must remain fully functional with the network off (stale-flagged).

## Water Prediction (v3.0)
Predict each plant's next watering from its event history + care profile + weather + container/soil, improving on the static seasonal interval. Surfaces as a smarter "needs attention" signal.

## Fertilizer Advisor (v3.0)
Recommend product, dose, and timing per plant from species, season, growth stage, and fertilizing history; Karachi-aware (e.g. iron for curry leaf, bloom feed for plumeria Mar–Sep).

## Propagation Advisor (v3.0)
Best time/method to propagate given species, season, and the plant's condition; ties into the existing propagation-lineage model.

## Plant Doctor (v3.0)
Symptom Q&A grounded in the specific plant's history + local knowledge base: "why are my chili leaves curling?" answered from that plant's events, recent weather, and the climate profile.

## Garden Assistant (v3.0)
Conversational assistant over the garden's own data ("what did I harvest last winter?", "which plants are overdue?"), voice-optional (Web Speech API, on-device where possible).

## Garden Analytics (v1.4 seed → v3.0 depth)
Foundation shipped in v1.4 (stats, watering/activity charts). Future: yield trends YoY, pest-outbreak/treatment-efficacy analytics, a composite garden-health index, care effort/cost analytics.

## Knowledge Graph (v3.0+)
A local, curated, Karachi-aware plant knowledge base linking species ↔ care ↔ pests ↔ treatments ↔ seasons, powering the advisors and the doctor. Data, not code; user-extensible; ships with the app, offline.

## Growth Prediction (v3.0+ / v6.0)
Project growth and seasonal outcomes from years of accumulated per-plant history; feeds the v6.0 digital-twin simulations ("what if I move the bougainvillea to the east wall?").

## Future Local AI (v3.0+)
Track the maturing on-device model ecosystem (WebGPU, small LMs in-browser). Goal: capable assistance with no server and no recurring cost, keeping the offline-first, user-owns-data guarantees intact.

---

### Sequencing summary
v2.0 Plant/Disease Vision → v2.5 Weather Intelligence → v3.0 Garden AI (doctor, advisors, prediction, assistant, knowledge graph) → v4.0 optional encrypted sync → v5.0 IoT sensors → v6.0 digital twin. Each era flips feature flags behind interfaces that already exist; none breaks offline-first.
