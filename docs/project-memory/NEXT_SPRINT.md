# GardenOS — Next Sprint

**This file always contains ONLY the next (current) sprint.** Replace its contents after the sprint completes.

---

## Sprint S-14 — Photo-Audit Corrections

**Status:** Ready, but **BLOCKED on owner confirmation** (two questions below). Do not apply data changes until answered.
**Target version:** `1.5.0-dev.7`.

### Background
On 2026-07-12 a human-in-the-loop photo audit (Claude vision over the owner's backup `gardenos-backup-2026-07-11-22-07.json`) reviewed all 32 plant photos vs. records. IDs were overwhelmingly correct. Findings and the full proposed change set are in [ENGINEERING_LOG.md](ENGINEERING_LOG.md) (2026-07-12 photo-audit entry). Nothing has been applied.

### Objectives
Correct the identified plant-data inconsistencies safely, without clobbering any owner edits made since the backup.

### Scope
1. **Category corrections** for renamed ornamentals/foliage/climbers/succulents that today's name-keyed auto-recategorization missed (e.g. Bougainvillea 1–4 → climber, Snake Plant 1–3 → succulent, palms/ferns/rubber/hosta → foliage, Money Plant → climber, Motia/Rose/Hibiscus → shrub, Coleus/Umbrella Plant → foliage, Copperleaf → shrub).
2. **Specific data fixes:** add `Rosa indica` to "Rose Pink".
3. **ID flags (owner decides the name):** "Bamboo Palm" looks like a Dracaena cane, not a Chamaedorea; "Copperleaf" low-confidence. Only touch their category unless the owner confirms a rename.
4. *(Optional)* convert audit health observations (jasmine heat stress, bamboo-palm cane lesions, soil algae) into pest/observation records.

### Mechanism (recommended)
A guarded, one-time correction routine mirroring `ensureGardenRecategorized` (AD-009): keyed by plant name, changing a plant's category **only if it still equals the wrong value**, idempotent, flag-gated in `appMeta`. Add the Rose-Pink botanical the same way. This never overwrites divergent live data and is a no-op on fresh installs. **Do not** apply via a full backup restore (the live DB has diverged from the snapshot).

### Blocking questions for the owner
1. **Scope:** photo-verified plants only, or the full set (incl. renamed non-photographed foliage/climbers)? (Recommend: full set — logic is identical.)
2. **Flags:** confirm/rename Bamboo Palm & Copperleaf yourself (routine only touches category), and OK to add *Rosa indica* to Rose Pink?

### Deliverables
- Guarded correction routine + test (applies once, spares user-edited categories, idempotent); verified live; committed with version + cache bump; deployed.
- Memory system updated; this file replaced with S-15.

### Risks
- Backup is a point-in-time snapshot; the routine must be name/field-surgical (mitigated by the AD-009 pattern).
- Baking owner-specific plant names into a correction list is acceptable for this personal deployment; keep it flag-guarded and removable.

### Success Criteria
- Confirmed plants land in the correct categories; Rose Pink gains its botanical; no unrelated fields or user edits changed; full suite green live.

---

## On deck (after S-14)
- **S-15 — v1.x stabilization & exit-gate support:** address friction from real use; support owner exit gates (validation week, 200-photo Android perf, winter-crop cycle, one-month recurrence soak); then finalize `1.5.0` and decide on tagging v1.1–v1.5.
- Then the **v2.0 AI era** begins with an ADR (first-ever dependency) — see [GARDEN_AI_ROADMAP.md](GARDEN_AI_ROADMAP.md).
