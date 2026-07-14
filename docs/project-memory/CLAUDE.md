# GardenOS — Claude Operating Manual

**Every future Claude session must read this first**, then [HANDOFF.md](HANDOFF.md) and [PROJECT_STATE.md](PROJECT_STATE.md). This is the permanent constitution for working on GardenOS. The root-level `.md` docs (ARCHITECTURE.md, DATABASE.md, API_DESIGN.md, UI_GUIDELINES.md, CONTRIBUTING.md, ROADMAP.md, FEATURES.md, PROJECT_REQUIREMENTS.md, TODO.md) remain the detailed source of truth; this file is the distilled operating discipline.

---

## Project Vision
GardenOS is a lifelong, offline-first Gardening Operating System for a home gardener in Karachi, Pakistan — built to evolve for 20 years from a local plant journal into an AI-assisted, sensor-aware garden digital twin. It is a real production product, never a demo. Full vision: [PRODUCT_VISION.md](PRODUCT_VISION.md).

## Project Constitution (non-negotiable)
1. **Offline-first is inviolable.** No feature in v1.x may require a network. Network features (v2.5+) are progressive enhancements that degrade gracefully.
2. **Zero cost, zero lock-in.** Only free, open, standards-based tech. No Firebase/Supabase, no paid APIs, no accounts for core function.
3. **Zero runtime dependencies; no required build step.** The app must always run by serving the folder. Any dependency needs an ADR (see [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md)).
4. **The user owns their data.** It stays on-device; open formats; robust backup/restore; nothing is uploaded without explicit opt-in (future).
5. **Docs are law.** Code that contradicts the architecture docs is a bug — fix the code or amend the doc via an ADR. Never silently diverge.
6. **No placeholders.** A feature is complete + tested, behind a feature flag, or not merged. No stub functions, dead code, or lorem ipsum.
7. **AI suggests, the user confirms.** Any automated/AI change to user data is proposed for confirmation, never silently applied.

## Engineering Standards
- SOLID · DRY · KISS · YAGNI — with one deliberate exception: build forward-compatibility that is *cheap now and expensive later* (record envelopes, reserved stores, interface contracts). Do **not** build speculative features.
- ES6+ modules only; `const` default; strict equality; `async/await` with an error path on every await.
- Naming: `camelCase` funcs/vars, `PascalCase` classes/components/models, `SCREAMING_SNAKE` constants.
- Functions ≤ ~40 lines, files ≤ ~300 lines; restructure beyond that.
- JSDoc every exported function; module header comment states responsibility + layer.
- Comments explain **why/constraints**, never narrate the next line.
- No `innerHTML` with user data — build DOM via `utils/dom.js` helpers.

## Architecture Principles
- **Five layers, dependencies point strictly downward:** UI(L5) → Application(L4) → Business(L3) → Data(L2) → Platform(L1). Skipping downward is fine; importing upward is forbidden. Sibling L4 modules talk only via the event bus.
- **Repository pattern:** only `database/` touches IndexedDB. Everything above uses repositories/services.
- **Event-sourced care history:** care actions are immutable `events`; entity "current state" is derived caches, always recomputable.
- **Sync-ready envelope on every record** from day one: `id` (UUIDv4), `schemaVersion`, `createdAt`, `updatedAt`, `deletedAt`.
- **Event bus** for cross-module communication (namespaced topics in API_DESIGN.md §11); payloads carry ids, not records.
- **Feature flags** (`config/featureFlags.js`) gate future capabilities; roadmap versions flip flags, not architecture.
- **Registries** (`config/registries.js`) hold extensible vocabularies (categories, event types…): add an entry, not a code path.

## Offline-First Philosophy
Local IndexedDB is the source of truth. The service worker precaches the whole shell (bump `CACHE_VERSION` on every shell change — this is what triggers the update prompt). Never silent-reload over a user. Request persistent storage once data exists. Every release must survive "kill the server, reload, app still works."

## Database Principles
- One `gardenos` IndexedDB database; schema version integer, mirrored in `appMeta.schemaVersion` and DATABASE.md.
- **Forward-only migrations**, one file per version bump in `database/migrations/`, each with a fixture test. A failed migration must abort cleanly and never corrupt existing data.
- Reserved future stores are created empty at v1 so future eras need data, not structural migration.
- Multi-record writes use one transaction (atomicity). Soft-delete by default; permanent delete confirmed + cascaded in a transaction.
- IndexedDB can't index booleans → store indexed boolean-like fields as `0|1`.

## PWA Standards
Manifest + full icon set kept in sync. Service worker: precache list must list every shell module (audit it every release). Cache-first same-origin GET; navigation fallback to `index.html`. Consent-based update flow only. Serving origin is fixed and load-bearing — never change the port/path of an installed instance.

## UI Standards
- "Calm greenhouse"; dark default, applied pre-paint. All visual values from `styles/tokens.css` — no raw hex/px in component CSS.
- Mobile-first; 5-slot bottom nav max (extras live under "More"); touch targets ≥ 44px.
- WCAG 2.1 AA: semantic HTML, visible focus, keyboard operable, color never the sole signal, charts carry text alternatives.
- Destructive actions confirm and name the object. Bulk actions are undoable (batchId). Toasts for feedback.
- Respect `prefers-reduced-motion`. Animate only `transform`/`opacity`.

## Testing Standards
- Integration tests run in-browser against **real IndexedDB** (`tests/index.html`, disposable `gardenos-test` DB). Naming: `should <behavior> when <condition>`.
- The **backup round-trip test is release-blocking, every release.**
- A bug fix without a regression test is not done.
- Verification loop on this machine (no Node.js): `python3 tests/serve.py <port>`, open in Safari via AppleScript, read pass/fail from `document.title` (the runner and router write status there). Use a fresh port to bypass the service-worker-cached old shell. Parse-check with macOS JavaScriptCore: `jsc -m file.js` (a ReferenceError for window/document means it parsed fine).

## AI Philosophy
On-device first (preserve offline-first + zero-cost). AI writes back as first-class `analyses` records; every result stores provider + confidence; the user confirms/corrects (corrections are future training signal). AI reads the same event-sourced history everything else uses. The first AI feature requires an ADR (it will be the project's first dependency). Plan only until then: [GARDEN_AI_ROADMAP.md](GARDEN_AI_ROADMAP.md).

## Plant Knowledge Philosophy
Karachi climate is the anchor (`config/climate.karachi.js`). Care knowledge is **data, not code** (seed files in `database/seed/`, editable by the user). Care profiles resolve effective values as: per-plant override → seasonal profile value → base profile value. Never guess an interval — unset means unset. Horticultural seed data is reviewed for correctness like code is reviewed for logic.

## Refactoring Rules
Refactor behind green tests only. Keep changes small and increment-sized. Preserve the record envelope and public service/repository contracts. If a refactor changes an architecture doc or a schema, write an ADR + migration. Never mix a refactor and a feature in one commit.

## Architecture Audit Rules
Periodically (and before each major version) audit: layer-dependency violations, dead code, precache-list completeness, migration/test parity, doc drift, and dependency creep. Record findings in [KNOWN_TECH_DEBT.md](KNOWN_TECH_DEBT.md); record any resulting decisions in [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md).

## Future Development Rules
- Work in **sprints**. Each sprint: implement → verify live → commit with a descriptive message → **update the memory system** (PROJECT_STATE, HANDOFF, ENGINEERING_LOG, NEXT_SPRINT; KNOWN_TECH_DEBT if changed; ARCHITECTURE_DECISIONS on audits).
- Bump `APP_VERSION` (`config/constants.js`) and `CACHE_VERSION` (`pwa/service-worker.js`) together on every shippable change; add new modules to the precache list.
- Commit messages end with the project's Co-Authored-By trailer. Branch off `main`; `main` stays releasable.
- On the owner's machine, `sh deploy-local.sh` after changes so the installed app can pick up the update.
- Deliver incrementally — never generate the whole application in one response.
