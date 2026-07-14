# GardenOS — Session Handoff

**Purpose:** Let any future Claude session continue GardenOS development immediately.
**Read order for a new session:** [CLAUDE.md](CLAUDE.md) → this file → [PROJECT_STATE.md](PROJECT_STATE.md) → [NEXT_SPRINT.md](NEXT_SPRINT.md).
**Update after every completed sprint.**

- **Handoff date:** 2026-07-12

## Current Version
`1.5.0-dev.6`. Released tag: `v1.0.0`. The v1.x offline core is code-complete; v1.1–v1.5 await owner exit gates before tagging.

## Completed Work
- v1.0 Foundation (released), v1.1 Plant Manager, v1.2 Image Manager, v1.3 Kitchen Garden, v1.4 Dashboard, v1.5 Task Scheduler — all code-complete, 58 tests green.
- Post-v1.5: care-profile management UI + per-plant watering override; six new plant categories; automatic owner starter-garden seeding; one-time category recategorization; local Mac deployment (LaunchAgent + `deploy-local.sh`).
- Full history: [ENGINEERING_LOG.md](ENGINEERING_LOG.md).

## Current Sprint
**Sprint S-13 — "Daily tracking usability" — ✅ COMPLETE (committed `758f2cb`, deployed).** Delivered: (1) Plants location filter (`listPlants` `locationId` + async-populated Location select, combines with other filters); (2) per-plant progress notes + flowering/fruiting/new-growth milestone event types (icons added; plant-detail action relabeled "Add note / update…", defaults to a dated observation). 60 tests green live. **Next up: Sprint S-14** — see [NEXT_SPRINT.md](NEXT_SPRINT.md).

## Last Commit
`758f2cb` — feat: location filter + per-plant progress notes & milestones (Sprint S-13).

## Current Branch
`main`.

## Next Priority
**Sprint S-14 — Photo-audit corrections** (see NEXT_SPRINT.md), which is **blocked on the paused owner decision below**. If the owner hasn't answered, ask the two questions (scope + the three ID flags) before applying anything. If S-14 stays blocked, proceed to S-15 stabilization.

## Paused / awaiting owner input
1. **Category-correction application** (from the photo-audit): owner was asked (a) apply photo-verified changes only vs. the full set incl. renamed non-photographed foliage/climbers, and (b) confirm the three flags (Bamboo Palm likely a Dracaena cane; Copperleaf low-confidence ID; add *Rosa indica* to Rose Pink). **No changes applied yet.** The proposed change set is in [ENGINEERING_LOG.md](ENGINEERING_LOG.md) under the 2026-07-12 photo audit. Recommended mechanism: a guarded one-time correction keyed by plant name that only touches the category field (+ Rose Pink botanical), mirroring `ensureGardenRecategorized`.

## Known Technical Debt
See [KNOWN_TECH_DEBT.md](KNOWN_TECH_DEBT.md). Highlights: owner real-world **exit gates** still open for v1.1 (validation week), v1.2 (200-photo Android perf), v1.3 (winter-crop cycle), v1.5 (one-month recurrence soak); Lighthouse audit deferred (no Chrome tooling on the machine); attach-image-from-event/note/pest UI pending (T-052); selective/CSV export pending (T-029).

## Open Questions
- Should v1.1–v1.5 be tagged now (code-complete) or held until owner exit gates pass? (Current stance: hold; they're real-use validations.)
- Do progress-note milestones (flowering/fruiting) warrant per-plant "current phase" derived state, or is the timeline sufficient? (Current stance: timeline is sufficient; revisit if a dashboard "what's flowering now" view is wanted.)
- When v2.0 begins, which on-device model stack (TF.js vs. transformers.js/WebGPU)? Requires an ADR — first-ever dependency.

## Current Risks
- **Data-loss risk is owner-side:** data lives only in the browser at `http://127.0.0.1:8080`; mitigated by backups (owner must keep them off-device). No cloud sync until v4.0.
- **Backup used for the photo audit is a point-in-time snapshot** (2026-07-11 22:07); the live DB may have diverged. Any correction must be name/id-keyed and field-surgical, not a full restore.
- **Single serving origin is load-bearing:** changing the port/address orphans the IndexedDB data. Documented in README.

## Recommended Next Sprint
After S-13: **S-14 "Photo-audit corrections"** — apply the confirmed category/botanical corrections via a guarded one-time routine, and optionally convert the audit's health observations (jasmine heat stress, bamboo-palm cane lesions, soil algae) into pest/observation records. Then **S-15 "v1.x stabilization & exit-gate support"**.

## Estimated Next Version
`1.5.0` (drop the `-dev` suffix) once S-13 lands and stabilization completes; then evaluate tagging v1.1–v1.5 retroactively or rolling into a single `1.5.0` "offline core complete" milestone. AI era begins at `2.0.0` (gated by an ADR).
