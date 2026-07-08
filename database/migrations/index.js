/**
 * Migration registry (Data layer, L2) — DATABASE.md §7.
 * One migration per schema version bump, forward-only, run in order by
 * database/db.js during onupgradeneeded. Adding a migration requires:
 *   1. a new NNN_name.js file exporting {version, name, upgrade},
 *   2. registering it here IN ORDER,
 *   3. bumping DB_SCHEMA_VERSION in config/constants.js,
 *   4. a fixture test in tests/ proving data survives the upgrade,
 *   5. a DATABASE.md §7 update (CONTRIBUTING.md §6.3).
 */

import { migration001 } from './001_initial_schema.js';

export const migrations = Object.freeze([migration001]);
