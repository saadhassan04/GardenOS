# GardenOS — Known Technical Debt

Tracked by severity. Update after every Architecture Audit and whenever debt is added or resolved.
Last reviewed: 2026-07-12.

---

## High
*(none currently — the codebase is clean; the highest-impact open items are owner-side validation gates, listed under Medium as they are process, not code defects.)*

## Medium

- **TD-M1 — Owner exit gates unmet (v1.1–v1.5 untagged).** Real-world validations still pending: v1.1 daily-use week (T-040), v1.2 200-photo Android performance (T-054), v1.3 full winter-crop cycle, v1.5 one-month recurrence soak (T-085). *Impact:* v1.1–v1.5 stay code-complete but unreleased. *Action:* support owner in real use; tag when passed.
- **TD-M2 — In-flight uncommitted work.** Location filter edits sit in the working tree (`pages/PlantsPage.js`, `services/plantService.js`) without version bump/test/commit. *Impact:* risk of loss / confusion. *Action:* finish in Sprint S-13.
- **TD-M3 — Photo-audit corrections not applied.** Confirmed inconsistencies (categories for renamed ornamentals; Bamboo Palm likely mis-ID; Copperleaf low-confidence; Rose Pink missing botanical) identified but not yet corrected. *Impact:* data slightly inaccurate. *Action:* Sprint S-14, pending owner confirmation.
- **TD-M4 — Name-keyed recategorization misses renamed plants.** `ensureGardenRecategorized` matches exact seed names, so owner-renamed plants ("Bougainvillea 1 White") were not auto-corrected. *Impact:* several plants retain old categories. *Action:* folded into TD-M3 (S-14 correction set covers renamed plants).

## Low

- **TD-L1 — Attach-image-from-event/note/pest UI (T-052).** Image records/services support these links; only the plant-attach and cover UI exist. *Action:* add when needed.
- **TD-L2 — Selective / CSV export (T-029, FR-9.3).** Full backup exists; per-collection JSON + CSV (e.g. harvests) not built. *Action:* deliver alongside an analytics/reporting need.
- **TD-L3 — Lighthouse audit deferred.** No Chromium tooling on the owner's machine. *Impact:* PWA score unverified (low risk for a static precached shell). *Action:* run when Chrome/CI is available.
- **TD-L4 — Category spelling inconsistency in owner data.** Plants named "Green Chili 1" vs "Green Chilli 2/3/4" (cosmetic). *Action:* owner's choice; not code.
- **TD-L5 — Chilli group category split.** "Green Chilli 4" is `seedling` while siblings are `vegetable` (a reasonable stage distinction, flagged for awareness). *Action:* none unless owner wants consistency.
- **TD-L6 — Derived-cache rebuild tool.** Derived plant caches are maintained incrementally and on undo; a full "rebuild all derived caches" Diagnostics action (mentioned in ADR-0002 consequences) is not yet built. *Action:* add to Diagnostics if a drift bug ever appears.
- **TD-L7 — No automated CI.** Tests run manually in Safari (no Node.js). *Impact:* relies on discipline. *Action:* optional lightweight CI if the toolchain changes.

## Resolved

- **TD-R1 — jsc `--parse-only` flag misuse (increment 1).** Corrected to `jsc -m file.js` module execution (parse + import-graph). Resolved 2026-07-09.
- **TD-R2 — Same-millisecond list ordering nondeterminism.** Plant "newest" sort and note recency now tiebreak by name/title. Resolved 2026-07-09 (v1.1 inc.3).
- **TD-R3 — Storage-stats NaN for records lacking `byteSize`.** Falls back to blob size. Resolved 2026-07-09 (v1.2).
- **TD-R4 — Noon-anchored test fixtures time-of-day flake.** Switched to exact elapsed offsets. Resolved 2026-07-09 (v1.5).
- **TD-R5 — `setFlag()` missing keyed argument (keyPath error).** Early-return path fixed to pass the flag key. Resolved 2026-07-12.
- **TD-R6 — Safari heuristic ES-module caching served stale modules.** `tests/serve.py` no-cache dev server added; documented. Resolved 2026-07-09.
