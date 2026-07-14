# GardenOS — Session Handoff

**Purpose:** Let any future Claude session continue GardenOS development immediately.
**Read order for a new session:** [CLAUDE.md](CLAUDE.md) → this file → [PROJECT_STATE.md](PROJECT_STATE.md) → [NEXT_SPRINT.md](NEXT_SPRINT.md).
**Update after every completed sprint.**

- **Handoff date:** 2026-07-15

## Current Version
`1.5.0-dev.8`. Released tag: `v1.0.0`. The v1.x offline core is code-complete; v1.1–v1.5 await owner exit gates before tagging.

## Completed Work
- v1.0 Foundation (released), v1.1 Plant Manager, v1.2 Image Manager, v1.3 Kitchen Garden, v1.4 Dashboard, v1.5 Task Scheduler — all code-complete, 58 tests green.
- Post-v1.5: care-profile management UI + per-plant watering override; six new plant categories; automatic owner starter-garden seeding; one-time category recategorization; photo-audit corrections; local Mac deployment (LaunchAgent + `deploy-local.sh`).
- Full history: [ENGINEERING_LOG.md](ENGINEERING_LOG.md).

## Current Sprint
**Sprint S-15 — "v1.x stabilization" — ✅ COMPLETE (committed `59bc177`, deployed).** Closed TD-L6: Diagnostics → Maintenance → "Rebuild derived caches" recomputes every plant's cache from the events + images that own the truth, reporting scanned vs. repaired. `recomputeDerived()` now covers `imageCount` too, so there is one definition of a rebuild rather than two partial paths. 62 tests green live; the UI was exercised end-to-end. **Deliberately did not finalize `1.5.0`** — that waits on the owner's exit gates.

Previous: **Sprint S-14 — "Photo-audit corrections" — ✅ COMPLETE (`cb6effb`).** Owner answered both blocking questions on 2026-07-15 (full set; Bamboo Palm & Copperleaf keep their names — category only; *Rosa indica* confirmed). `ensurePhotoAuditCorrected()` applies 22 category fixes + Rose Pink's botanical, keyed by the owner's *current* plant names.

## Last Commit
`59bc177` — feat: rebuild derived caches from Diagnostics (Sprint S-15).

## Current Branch
`main`.

## Next Priority
**The owner's four exit gates** (TD-M1) — they are real-world validations, not code, and they are now the only thing between `1.5.0-dev.8` and a finalized `1.5.0`. No further sprint is queued or needed; see NEXT_SPRINT.md (S-16 is intentionally owner-driven and empty of invented work).

## Paused / awaiting owner input
1. **The S-14 corrections take effect when the owner next opens the app** at `http://127.0.0.1:8080` and accepts the "Update available" prompt — the routine runs once at startup against their live IndexedDB. Expect 23 changes (22 categories + Rose Pink's botanical). Nothing to do in code; just confirm the Plants page looks right afterwards.
2. **Two plant names remain unconfirmed** (TD-M5): "Bamboo Palm" is most likely a *Dracaena* cane rather than a *Chamaedorea*, and "Copperleaf" was a low-confidence ID. The owner chose to keep both names in S-14 (categories were corrected regardless) and will verify against the live plants — renaming is a manual edit, no code needed.

## Known Technical Debt
See [KNOWN_TECH_DEBT.md](KNOWN_TECH_DEBT.md). Highlights: owner real-world **exit gates** still open for v1.1 (validation week), v1.2 (200-photo Android perf), v1.3 (winter-crop cycle), v1.5 (one-month recurrence soak); Lighthouse audit deferred (no Chrome tooling on the machine); attach-image-from-event/note/pest UI pending (T-052); selective/CSV export pending (T-029).

## Open Questions
- Should v1.1–v1.5 be tagged now (code-complete) or held until owner exit gates pass? (Current stance: hold; they're real-use validations.)
- Do progress-note milestones (flowering/fruiting) warrant per-plant "current phase" derived state, or is the timeline sufficient? (Current stance: timeline is sufficient; revisit if a dashboard "what's flowering now" view is wanted.)
- When v2.0 begins, which on-device model stack (TF.js vs. transformers.js/WebGPU)? Requires an ADR — first-ever dependency.

## Current Risks
- **Data-loss risk is owner-side:** data lives only in the browser at `http://127.0.0.1:8080`; mitigated by backups (owner must keep them off-device). No cloud sync until v4.0.
- **Backups are point-in-time snapshots; the live DB diverges from them.** Any data correction must be name/id-keyed and field-surgical, never a full restore (AD-009). S-14 followed this and was keyed off the fresher 2026-07-13 backup.
- **Single serving origin is load-bearing:** changing the port/address orphans the IndexedDB data. Documented in README.

## Recommended Next Sprint
None invented. v1.x is feature-complete, code-complete, and stabilized at 62 green tests; the remaining work is the owner's real-use validation (TD-M1). The next *code* sprint should be whatever friction that validation surfaces — or, once the gates pass, cutting `1.5.0` and opening the v2.0 AI era with an ADR. The audit's health observations were deliberately left unlogged (TD-L8) rather than back-dated into the event log.

## Estimated Next Version
`1.5.0` (drop the `-dev` suffix) once the exit gates pass; then evaluate tagging v1.1–v1.5 retroactively or rolling into a single `1.5.0` "offline core complete" milestone. AI era begins at `2.0.0` (gated by an ADR).
