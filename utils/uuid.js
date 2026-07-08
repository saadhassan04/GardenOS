/**
 * UUID generation (Platform layer, L1) — ARCHITECTURE.md §13.
 * All primary keys are UUIDv4 so records are globally unique across devices,
 * which keeps future sync merges and backup imports collision-free (ADR-0002).
 */

/** @returns {string} a UUIDv4 */
export function uuid() {
  return crypto.randomUUID();
}
