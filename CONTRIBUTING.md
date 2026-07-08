# Contributing to GardenOS

**Document status:** Living document · 2026-07-09
**Applies to:** every change, whether written by the owner, a collaborator, or an AI pair-engineer. GardenOS is maintained to enterprise standards regardless of team size.

---

## 1. Ground Rules

1. **Documentation is law.** ARCHITECTURE.md, DATABASE.md, and API_DESIGN.md define the system. Code that contradicts them is a bug — either fix the code or amend the doc via an ADR (`docs/adr/`), never silently diverge.
2. **No dependencies.** v1.x ships with zero runtime dependencies. Adding any dependency (even dev-time) requires an ADR stating the need, the maintenance risk, and the removal plan.
3. **Offline-first is inviolable.** No change may make any v1.x feature require a network connection.
4. **Data safety outranks features.** Any change touching `database/`, backup, restore, or migrations must include tests and must pass the backup→wipe→restore round-trip before merge.
5. **No placeholders.** No TODO-stub functions, no lorem ipsum, no dead code paths shipped. A feature is either complete and tested, behind a feature flag, or not merged.

## 2. Engineering Principles

SOLID · DRY · KISS · YAGNI — applied with judgment:

- **S**ingle responsibility: one module = one reason to change. If a file needs "and" to describe it, split it.
- **O**pen/closed in the places designed for it: widget registry, event-type registry, provider interfaces (weather/AI/sync). Extend by adding, not by editing.
- **L**iskov: every repository honors `IRepository<T>`; every provider honors its interface in API_DESIGN.md — consumers must never care which implementation they got.
- **I**nterface segregation: services expose small purpose-built methods, not god-objects.
- **D**ependency inversion: layers depend on contracts downward only (ARCHITECTURE.md §3 dependency rule — enforced in review).
- **YAGNI, with one exception:** we *do* build forward-compatibility that is cheap now and expensive later (record envelopes, reserved stores, interface contracts). We do *not* build speculative features.

## 3. Code Style

### JavaScript
- ES6+ modules only; `import`/`export`, no globals except the documented `window.GardenOS` debug namespace (dev builds only).
- `const` by default, `let` when required, `var` never. Strict equality always.
- `async/await` over raw promise chains; every awaited call has an error path.
- Naming: `camelCase` functions/variables · `PascalCase` classes/components/models · `SCREAMING_SNAKE` constants · file names `camelCase.js` (components `PascalCase.js`).
- Functions ≤ ~40 lines; files ≤ ~300 lines — beyond that, restructure.
- No `innerHTML` with any user-originated string. DOM built via helpers / `textContent`.
- JSDoc on every exported function: params, return, thrown errors. Module header comment stating responsibility and layer.
- Comments explain **constraints and why**, never narrate what the next line does.

### CSS
- All values from tokens (`styles/tokens.css`); component styles in `styles/components.css` scoped by block class (`.plant-card`, `.plant-card__title` — BEM-lite).
- Mobile-first media queries (`min-width` only). No `!important` outside documented utility overrides.

### HTML
- Semantic elements first; ARIA per UI_GUIDELINES.md §10; valid per W3C validator at release.

## 4. Git Workflow

- **Branches:** `main` (always releasable) · `feature/<roadmap-id>-<slug>` (e.g., `feature/v1.1-plant-crud`) · `fix/<slug>`.
- **Commits:** Conventional Commits — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `perf:`, `chore:`; imperative subject ≤ 72 chars; body explains *why*. One logical change per commit.
- **Never commit:** user data, backup archives (`backups/`, `export/`, `import/` contents are git-ignored), secrets (there should be none), generated artifacts.
- **Tags:** every release tagged `v<semver>` after the release checklist passes.

## 5. Definition of Done (every change)

- [ ] Conforms to ARCHITECTURE.md layers & dependency rule
- [ ] Models validate inputs; repositories transact multi-record writes
- [ ] Unit tests for logic; integration tests for anything touching IndexedDB
- [ ] Works fully offline; verified on mobile viewport (360 px) and desktop
- [ ] Both themes checked; keyboard + screen-reader pass on new UI
- [ ] No console errors/warnings; no new Lighthouse regressions
- [ ] JSDoc + any affected .md documents updated
- [ ] CHANGELOG.md `[Unreleased]` entry added

## 6. Release Checklist (per ROADMAP.md version)

1. All exit-gate items for the version pass (ROADMAP.md).
2. Full test suite green, including the **release-blocking backup→wipe→restore round-trip**.
3. If schema changed: migration merged + tested against a fixture of the previous version's data; DATABASE.md §7 updated.
4. Lighthouse PWA ≥ 90; WCAG AA spot-check; both-theme review.
5. FEATURES.md statuses flipped; TODO.md groomed; ROADMAP.md dates refreshed.
6. CHANGELOG.md: move `[Unreleased]` → `[x.y.z] - YYYY-MM-DD`.
7. Tag, then create a fresh backup with the new version before daily use.

## 7. Testing Standards

- **Unit** (`tests/unit/`): models, services, utils — pure, fast, no IndexedDB.
- **Integration** (`tests/integration/`): repositories against real IndexedDB in the browser; migration fixtures; backup round-trip; router flows.
- Test naming: `should <behavior> when <condition>`. A bug fix without a regression test is not done.
- Horticultural seed data (care presets, sowing calendar) is reviewed for agronomic correctness like code is reviewed for logic.

## 8. Architecture Decision Records

Any decision that changes ARCHITECTURE.md, DATABASE.md schema philosophy, API_DESIGN.md contracts, the stack, or adds a dependency → copy `docs/adr/ADR-0000-template.md`, number it, link it from the amended doc. ADRs are never deleted; superseded ones are marked as such.
