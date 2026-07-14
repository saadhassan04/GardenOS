# GardenOS — Next Sprint

**This file always contains ONLY the next (current) sprint.** Replace its contents after the sprint completes.

---

## Sprint S-16 — Exit-Gate Validation (owner-driven)

**Status:** Open, and deliberately **not pre-filled with code work**. v1.x is feature-complete, code-complete, and stabilized (62 green tests). What remains is not something a Claude session can do alone — it is the owner using the app in the real garden.
**Target version:** `1.5.0` (drop the `-dev` suffix) once the gates below pass.

### Why this sprint has no invented backlog
The constitution says: no placeholders, no speculative features (YAGNI). v1.x has no known defects and no missing v1 feature. Inventing a sprint to look busy would add code the owner never asked for to a product whose next real risk is *unvalidated real-world use*, not *insufficient features*. So this sprint is a checklist, not a build.

### The four exit gates (TD-M1)
| Gate | Version | What passing looks like |
|---|---|---|
| Daily-use week (T-040) | v1.1 | A full week of real logging without friction or workarounds |
| 200-photo Android performance (T-054) | v1.2 | Gallery/ingest stay responsive at ~200 photos on the owner's phone |
| Full winter-crop cycle | v1.3 | One Karachi winter crop sown → harvested through the app |
| One-month recurrence soak (T-085) | v1.5 | A month of recurring tasks spawning correctly, no drift |

### What a Claude session should do here
1. **Ask the owner what actually broke or annoyed them.** Real friction beats guessed friction; fix that.
2. **Do not add features to fill the sprint.** If nothing surfaced, the correct outcome is "gates progressed, no code changed."
3. **If a bug surfaces:** fix it with a regression test (a fix without one is not done), verify live, commit, update memory.
4. **When all four gates pass:** cut `1.5.0` (APP_VERSION + CACHE_VERSION), and settle the standing open question — tag v1.1–v1.5 retroactively, or roll them into a single `1.5.0` "offline core complete" milestone (current lean: the single milestone; the intermediate tags never shipped to anyone).

### Owner-side items carried in
- **TD-M5 — two unconfirmed plant IDs.** "Bamboo Palm" is most likely a *Dracaena* cane; "Copperleaf" was a low-confidence ID. S-14 corrected their categories and left the names alone by the owner's choice. Resolve by looking at the actual plants; renaming is a manual edit, no code.
- **TD-L8 — audit health observations** (jasmine heat stress, bamboo-palm cane lesions, soil algae, all 2026-07-11) were never logged, on purpose — back-dating unwitnessed events would pollute the history v2.0 AI reads. Log by hand if the conditions persist.
- **TD-L9 — the two one-off correction routines** (`ensureGardenRecategorized`, `ensurePhotoAuditCorrected`) can be deleted once their flags are set on every install the owner uses. If a *third* correction is ever needed, build a generic mechanism instead of a third one-off.

### Success Criteria
- Gates progressed or passed with evidence from real use; any surfaced bug fixed with a regression test; suite green.
- `1.5.0` cut only when the gates actually pass — not to tidy the version number.

---

## On deck (after S-16)
- **v2.0 AI era**, opened by an ADR for the project's first-ever runtime dependency (on-device model stack: TF.js vs. transformers.js/WebGPU). The ground is already prepared — event-sourced history, reserved `analyses` store, documented `IPlantIdentifier`/`IDiseaseDetector`/`IGardenAdvisor` contracts. See [GARDEN_AI_ROADMAP.md](GARDEN_AI_ROADMAP.md).
- The 2026-07-12 photo audit is the manual precursor to that era: it proves the value (it found real errors) and the workflow (AI proposes, owner confirms — never silent writes).
