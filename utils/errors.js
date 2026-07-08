/**
 * Typed error hierarchy (Platform layer, L1) — ARCHITECTURE.md §13.
 * Services throw these; modules translate them into user-facing feedback.
 */

export class GardenOSError extends Error {
  /**
   * @param {string} message developer-facing description
   * @param {{cause?: Error, details?: object}} [options]
   */
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.details = options.details ?? null;
  }
}

/** Invalid input rejected at the model boundary (L2). */
export class ValidationError extends GardenOSError {}

/** A referenced record does not exist (or is soft-deleted). */
export class NotFoundError extends GardenOSError {}

/** IndexedDB / LocalStorage failure, including quota exhaustion. */
export class StorageError extends GardenOSError {}

/** Network failure in an optional online feature (weather, sync…). */
export class NetworkError extends GardenOSError {}

/** Schema migration failure — always surfaced prominently, never swallowed. */
export class MigrationError extends GardenOSError {}
