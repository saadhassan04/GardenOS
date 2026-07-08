# Changelog

All notable changes to GardenOS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versioning policy:
- **MAJOR** — new capability era per ROADMAP.md (AI, cloud, IoT…) or breaking data-schema change without automatic migration (should never happen).
- **MINOR** — new feature module or significant feature addition; may include an automatic schema migration.
- **PATCH** — fixes, performance, documentation, refactors with no behavior change.

Database schema versions are tracked independently in [DATABASE.md](DATABASE.md) §7 and referenced here whenever a release migrates the schema.

## [Unreleased]

### Added
- Complete project initialization: directory structure and full documentation set
  (README, PROJECT_REQUIREMENTS, ARCHITECTURE, ROADMAP, DATABASE, FEATURES,
  API_DESIGN, UI_GUIDELINES, CONTRIBUTING, LICENSE, TODO, ADR-0000 template,
  ADR-0001 technology stack, ADR-0002 storage strategy).
- Defined v1 IndexedDB schema (schema version 1) — design only, not yet implemented.
- Defined service interface contracts for weather, AI, storage, import/export,
  sync, and sensors — design only, not yet implemented.

### Notes
- **No application code exists yet.** Implementation begins with v1.0 (Foundation)
  after documentation approval, per ROADMAP.md Phase 0 gate.
