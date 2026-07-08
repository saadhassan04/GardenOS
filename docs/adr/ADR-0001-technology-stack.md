# ADR-0001 — Vanilla Web Platform Stack (No Frameworks, No Build Requirement)

- **Status:** Accepted
- **Date:** 2026-07-09
- **Amends:** Establishes ARCHITECTURE.md §2 D1

## Context

GardenOS must remain maintainable and runnable for ~20 years (G1), cost nothing (G3), work fully offline (G2), and be sustainable by a single engineer (G6). Historical evidence: JavaScript frameworks have a dominant lifespan of roughly 5–8 years before major-version churn or community migration imposes forced rewrites (AngularJS→Angular, React class→hooks→server components, Vue 2→3 ecosystem breaks). Build toolchains churn even faster (Grunt→Gulp→Webpack→Rollup→Vite→…). Every dependency is also a supply-chain and abandonment risk over a 20-year horizon.

Meanwhile, the web platform itself is backwards-compatible by charter: HTML/CSS/DOM/ES-modules code written in 2015 still runs unmodified in 2026.

## Decision

Build GardenOS exclusively on web standards: **HTML5, CSS3 (custom properties/Grid/Flexbox), vanilla ES6+ modules, IndexedDB, LocalStorage, Service Workers, Web App Manifest.** Zero runtime dependencies in v1.x; no build step required to run the app (a static file server suffices). Structure discipline (layers, repositories, event bus, small component helpers) substitutes for what frameworks provide.

## Options Considered

| Option | Pros | Cons |
|---|---|---|
| **Vanilla web platform (chosen)** | Permanent APIs; zero cost; zero supply chain; no forced migrations; total code comprehension; instant "clone → serve → run" | Must hand-roll router, reactivity helpers, component conventions (~one-time cost in v1.0) |
| React/Vue/Svelte + Vite | Faster initial UI development; ecosystem components | Framework + toolchain churn over 20 yrs ≈ guaranteed rewrites; node_modules supply chain; build step becomes a runtime dependency of the project's future |
| Lit / web components (light library) | Standards-adjacent, small | Still a dependency with release cadence risk; native custom elements available anyway if wanted later |
| Native app (Flutter/React Native) | Device integration | Paid store accounts, SDK churn, platform lock-in — violates G3/G1; PWA covers install + offline needs |

## Consequences

- **Easier:** longevity, auditability, onboarding ("it's just the web platform"), offline packaging, zero-cost hosting anywhere.
- **Harder:** v1.0 must build small in-house helpers (router ~100 LOC, event bus ~50 LOC, DOM component helpers ~150 LOC) — budgeted in TODO T-010–T-014.
- Optional tooling (linters, test runner, minifier) may be used at dev time but the repo must always run without it.
- Any future dependency addition requires a new ADR (CONTRIBUTING.md §1.2).

## Review Trigger

Revisit if (a) a needed platform capability is unreachable without a library (e.g., on-device ML in v2.0 will legitimately need TensorFlow.js — that ADR will scope it), or (b) hand-rolled UI helpers exceed ~1,500 LOC and demonstrably slow feature work.
