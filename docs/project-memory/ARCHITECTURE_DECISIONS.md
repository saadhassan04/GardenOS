# GardenOS — Architecture Decisions

Chronological record of significant architectural decisions. New entries are appended. Formal ADR files also live in `docs/adr/`; this file is the consolidated, quick-reference log. Update on every architecture audit or significant decision.

Format per entry: **Decision · Reason · Alternatives Considered · Why Rejected · Future Impact · Date**.

---

## AD-001 — Vanilla web platform, no framework, no required build
- **Decision:** Build entirely on HTML5/CSS3/vanilla ES6 modules; zero runtime dependencies; no required build step. (Full: `docs/adr/ADR-0001`.)
- **Reason:** 20-year longevity; frameworks/toolchains churn on ~5-8 year cycles; the web platform is backward-compatible by charter; sustainable by one engineer; zero supply-chain risk.
- **Alternatives considered:** React/Vue/Svelte + Vite; Lit/web-components; native (Flutter/RN).
- **Why rejected:** Framework + build churn guarantees rewrites over 20 years; dependency/abandonment risk; native adds paid stores + SDK churn. PWA covers install + offline.
- **Future impact:** We hand-roll small helpers (router, event bus, DOM builders, charts). First dependency (on-device AI, v2.0) requires a new ADR.
- **Date:** 2026-07-09

## AD-002 — IndexedDB primary store; LocalStorage for preferences; event-sourced history
- **Decision:** All domain data (incl. image Blobs) in IndexedDB via repositories; LocalStorage only for small settings; care history is immutable event records with recomputable derived caches. (Full: `docs/adr/ADR-0002`.)
- **Reason:** IndexedDB is the only transactional, indexed, async, large-capacity browser store. Event-sourcing gives timeline, analytics, AI context, and mergeable sync "for free."
- **Alternatives considered:** LocalStorage-for-data; OPFS + custom format; SQLite-WASM; remote DB (Firebase/Supabase).
- **Why rejected:** LocalStorage too small/sync; OPFS/SQLite-WASM add complexity/dependency; remote violates offline-first + zero-cost.
- **Future impact:** Enables v4.0 sync via a repository decorator + oplog with no data migration. Derived caches must be maintained consistently (rebuild routine planned).
- **Date:** 2026-07-09

## AD-003 — Sync-ready record envelope from day one
- **Decision:** Every record carries `id` (UUIDv4), `schemaVersion`, `createdAt`, `updatedAt`, `deletedAt` from v1.0.
- **Reason:** Cheap now, expensive to retrofit; enables soft delete, tombstones, and future last-writer-wins sync.
- **Alternatives considered:** Add sync fields later when v4.0 arrives.
- **Why rejected:** Would require a full-data migration across years of records.
- **Future impact:** v4.0 conflict resolution and backup imports are collision-free.
- **Date:** 2026-07-09

## AD-004 — Reserved future object stores created empty at schema v1
- **Decision:** Create `analyses`, `weatherCache`, `sensorReadings`, `oplog` empty in migration 001.
- **Reason:** Store creation is cheap; avoids structural migrations when v2.0/v2.5/v4.0/v5.0 arrive.
- **Alternatives considered:** Add stores in later migrations as each era begins.
- **Why rejected:** Extra migration risk and schema-version churn for what costs nothing now.
- **Future impact:** Future eras seed data, not structure. Index additions later are still normal migrations.
- **Date:** 2026-07-09

## AD-005 — Cursor pagination via visited-offset, not key-range resumption
- **Decision:** Repository `query()` and timeline/gallery cursors resume by an opaque visited-count offset (`IDBCursor.advance`).
- **Reason:** Correct for every index, key type, and direction — including `prev` timelines and duplicate index keys (same-timestamp events), where key-range resumption silently skips records.
- **Alternatives considered:** Resume from the last-seen key + range bound.
- **Why rejected:** Skips/duplicates records when index keys collide.
- **Future impact:** Deep-page cost is native-side skipping — acceptable at garden scale; revisit via ADR if profiling ever demands.
- **Date:** 2026-07-09

## AD-006 — Backup archive v1: single JSON, checksum, inline base64 blobs
- **Decision:** One open JSON file: `{format, formatVersion, meta{checksum,schemaVersion,counts}, collections{store:{records,keys}}}`; SHA-256 over collections; Blob fields inline as `{__gardenosBlob:{base64,type}}`; out-of-line keys preserved; `appMeta` exported but never imported.
- **Reason:** Human-inspectable, self-verifying, captures everything incl. images in one portable file; device identity stays local on restore.
- **Alternatives considered:** Binary container / ZIP; separate image sidecar files.
- **Why rejected:** Added tooling/complexity; single JSON is simplest and diffable.
- **Future impact:** Restore across schema versions runs the migration chain; base64 inflates size (~33%) — acceptable now; revisit if archives get large.
- **Date:** 2026-07-09

## AD-007 — Event-driven, self-registering dashboard widgets
- **Decision:** Widgets self-register (`widgets/registry.js`) with `{id,title,order,render,refreshOn}`; the dashboard renders the registry in the user's saved order and re-renders individual widgets on their declared bus topics.
- **Reason:** Open/Closed — new widgets never touch dashboard code; live updates without full re-render.
- **Alternatives considered:** Hard-coded dashboard composition.
- **Why rejected:** Every widget change would edit the dashboard; no user reordering.
- **Future impact:** AI/weather/sensor widgets plug in behind feature flags with zero dashboard changes. Subscriptions must be torn down on navigation (implemented).
- **Date:** 2026-07-09 (v1.4)

## AD-008 — Recurrence: care cadence counts from completion; calendar schedules roll forward
- **Decision:** `daily`/`everyNDays` compute the next due date from the completion date; `weekly`/`monthly`/`seasonal` follow the calendar rolled past "now". Local-calendar math; month-end clamping; seasonal year rollover.
- **Reason:** Matches real care behaviour — a late watering shouldn't spawn an already-overdue next task, but a weekly chore keeps its weekday.
- **Alternatives considered:** Always-from-due-date; always-from-completion.
- **Why rejected:** Either alone produces wrong or overdue-on-spawn instances for half the patterns.
- **Future impact:** Task suggestions and completion undo depend on this; documented + tested (DST/month-end).
- **Date:** 2026-07-09 (v1.5)

## AD-009 — Guarded, one-time, field-surgical data corrections for owner data
- **Decision:** Correct already-seeded owner data (e.g. category recategorization) via a startup routine guarded by an `appMeta` flag that only changes a field when it still equals the original value — never a full restore.
- **Reason:** The live DB diverges from any backup; must not clobber user edits or unrelated fields; idempotent and safe on fresh installs.
- **Alternatives considered:** Full corrected-backup restore; bulk merge-import; manual per-record edits.
- **Why rejected:** Restore/merge risk overwriting divergent live data; manual edits don't scale.
- **Future impact:** Pattern for future owner-data corrections. Baking owner-specific values into source is acceptable only for this personal deployment; keep such routines flag-guarded and removable.
- **Date:** 2026-07-12

## AD-010 — Project Memory System (self-documenting handoff)
- **Decision:** Maintain `docs/project-memory/` (this system) as the canonical, always-current handoff so development no longer depends on Claude conversation context.
- **Reason:** GardenOS is a long-term project; sessions are ephemeral; the project must carry its own memory.
- **Alternatives considered:** Rely on git history + root docs + Claude auto-memory only.
- **Why rejected:** Git/root docs describe design, not live sprint state; Claude auto-memory is session-tooling, not in-repo project truth.
- **Future impact:** Every sprint must update these docs (see CLAUDE.md → Future Development Rules). A root `CLAUDE.md` pointer makes new Claude Code sessions auto-load the manual.
- **Date:** 2026-07-12
