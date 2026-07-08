# ADR-0002 — Storage Strategy: IndexedDB Primary, LocalStorage for Preferences, Event-Sourced History

- **Status:** Accepted
- **Date:** 2026-07-09
- **Amends:** Establishes ARCHITECTURE.md §2 D2/D4/D5 and DATABASE.md principles

## Context

GardenOS needs on-device storage for: structured records growing to ~300k+ over 20 years (NFR-3.1), binary image blobs approaching ~1 GB (DATABASE.md §8), transactional multi-record writes (NFR-4.1), and indexed queries that stay fast at scale (NFR-2.2) — all with zero cost and zero servers (G2/G3). It must also not paint us into a corner for v4.0 sync (FR-11.4).

## Decision

1. **IndexedDB** is the sole store for domain data, including image Blobs, accessed exclusively through repositories (single `gardenos` database, versioned schema per DATABASE.md).
2. **LocalStorage** is restricted to small UI preferences/settings via the `storage/` wrapper (synchronous + ~5 MB cap + string-only makes it unfit for anything else).
3. **Care history is event-sourced:** immutable `events` records; entity records hold only current state + recomputable derived caches.
4. **Every record carries a sync-ready envelope** (UUIDv4 id, `createdAt`/`updatedAt`, `deletedAt` tombstone, record-level `schemaVersion`) from v1.0.
5. Request **persistent storage** (`navigator.storage.persist()`) at first run to protect against browser eviction.

## Options Considered

| Option | Pros | Cons |
|---|---|---|
| **IndexedDB (chosen)** | Transactional, indexed, async, Blob support, GB-scale, universal browser support | Verbose API (hidden behind repositories); schema migrations need discipline (framework built in v1.0) |
| LocalStorage for data | Trivial API | Synchronous (jank), ~5 MB, no indexes/transactions/Blobs — disqualified |
| OPFS (Origin Private File System) + custom format | Fast file IO | No indexing/transactions — we'd rebuild a database; Safari maturity risk; revisit only as a Blob annex if image volume demands |
| SQLite-WASM (sql.js/wa-sqlite) | Real SQL | A dependency (violates ADR-0001) + WASM build churn + persistence still lands in IndexedDB/OPFS anyway |
| Remote DB (Firebase/Supabase) | Sync for free | Violates offline-first, zero-cost, and longevity constraints outright |

Event-sourcing vs. mutable rows: mutable "lastWatered" fields alone would destroy history — the timeline (FR-2), analytics (FR-8), AI training context (FR-11.3), and mergeable sync (FR-11.4) all fall out of the append-only event log. Derived caches give mutable-row read speed anyway.

## Consequences

- **Easier:** timeline/analytics/AI/sync (append-only merges trivially); single-file backup captures everything including images; 20-year data safety via migration framework + record-level lazy upgrades.
- **Harder:** repositories must maintain derived caches consistently (cache rebuild routine ships in Diagnostics); migrations require fixture tests every schema bump (CONTRIBUTING.md §6.3).
- Reserved empty stores (`analyses`, `weatherCache`, `sensorReadings`, `oplog`) are created at schema v1 so future eras arrive without structural migration.

## Review Trigger

Revisit Blob placement if image storage pressure exceeds quota comfort (consider OPFS annex for originals + IndexedDB thumbnails). Revisit envelope/conflict policy at v4.0 sync design (ADR to come, TODO T-130).
