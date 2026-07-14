# GardenOS — Next Sprint

**This file always contains ONLY the next (current) sprint.** Replace its contents after the sprint completes.

---

## Sprint S-15 — v1.x Stabilization & Exit-Gate Support

**Status:** Ready. No owner decision blocks the code items; the release items below are owner calls.
**Target version:** `1.5.0-dev.8` (see "Version policy" — this sprint does **not** finalize `1.5.0`).

### Background
The v1.x offline core is feature-complete and code-complete at 61 green tests. What stands between it and a finalized `1.5.0` is not missing features but **real-world validation**: four owner exit gates are still open (TD-M1). S-15 therefore adds no new user-facing capability — it closes documented debt and makes the open gates easier to pass and diagnose.

### Objectives
Reduce the risk that a long validation period turns up an un-diagnosable problem, and close the debt that v1.x shipped with.

### Scope
1. **Derived-cache rebuild action in Diagnostics (TD-L6).** ADR-0002 lists this as a consequence of derived caches: they are maintained incrementally and on undo, with no way to recover from drift. If drift appears during the owner's validation week, there is currently no fix short of a restore. Recompute every plant's derived cache from the immutable `events` log (the event-sourcing guarantee that makes this safe), reporting how many plants changed.
2. **Exit-gate support.** Whatever friction the owner reports from real use. *Nothing is queued here yet — this is owner-driven and must not be invented.*

### Explicitly out of scope
- **Finalizing `1.5.0` / tagging v1.1–v1.5.** The standing stance (HANDOFF → Open Questions) is to hold until the exit gates pass; they are real-use validations, not code checks. Dropping the `-dev` suffix is a release act and stays the owner's call.
- **New features.** v1.x is feature-complete; anything genuinely new belongs to a later sprint or the v2.0 AI era.
- **Auto-logging the photo audit's health observations** (TD-L8) — back-dating unwitnessed events would pollute the care history v2.0 AI reads.

### Version policy
Bump to `1.5.0-dev.8` (APP_VERSION + CACHE_VERSION together, as always). `1.5.0` proper is cut by the owner once the four gates pass.

### Deliverables
- Diagnostics rebuild action + test (recomputes from events; idempotent; a no-op run reports 0 changes); verified live; committed with version + cache bump; deployed.
- Memory system updated; this file replaced with S-16.

### Risks
- A rebuild that recomputes *wrongly* is worse than drift, because it overwrites good caches. Mitigation: derive strictly from the `events` log using the same code path `careEventService` already uses — no second implementation of the rules (DRY; a divergent copy would rot).
- Rebuilding a large garden touches every plant in one pass. Mitigation: garden scale is ~54 plants; revisit only if that stops being true.

### Success Criteria
- The owner can rebuild derived caches from Diagnostics and see what changed; a rebuild on healthy data changes nothing; full suite green live.

---

## On deck (after S-15)
- **Owner exit gates** (TD-M1): v1.1 daily-use week (T-040), v1.2 200-photo Android performance (T-054), v1.3 full winter-crop cycle, v1.5 one-month recurrence soak. These are real-use validations, not sprints — when they pass, finalize `1.5.0` and decide whether to tag v1.1–v1.5 retroactively or roll them into a single "offline core complete" milestone.
- Then the **v2.0 AI era** begins with an ADR (first-ever dependency) — see [GARDEN_AI_ROADMAP.md](GARDEN_AI_ROADMAP.md).
