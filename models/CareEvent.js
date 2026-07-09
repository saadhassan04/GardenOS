/**
 * Care event model (Data layer, L2) — DATABASE.md §3.2, FR-3.
 * Events are immutable once logged; corrections append superseding events
 * (ARCHITECTURE.md D4). Backdating is explicitly supported (FR-2.3).
 */

import { ValidationError } from '../utils/errors.js';
import { EVENT_TYPES } from '../config/registries.js';

/**
 * Validate and normalize a care event body.
 * @param {{plantId: string, type: string, occurredAt?: string, data?: object,
 *          imageIds?: string[], batchId?: string|null}} input
 * @returns {object} a complete, valid event record body (envelope excluded)
 * @throws {ValidationError}
 */
export function validateCareEvent(input) {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Event input must be an object');
  }

  const { plantId, type } = input;
  if (typeof plantId !== 'string' || plantId.length === 0) {
    throw new ValidationError('An event needs a plantId');
  }
  if (!(type in EVENT_TYPES)) {
    throw new ValidationError(`Unknown event type "${type}"`);
  }

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(occurredAt))) {
    throw new ValidationError('Event occurredAt is not a valid timestamp');
  }
  if (Date.parse(occurredAt) > Date.now() + 60_000) {
    throw new ValidationError('Events cannot be logged in the future');
  }

  const data = input.data ?? {};
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new ValidationError('Event data must be an object');
  }

  return {
    plantId,
    type,
    occurredAt: new Date(occurredAt).toISOString(),
    batchId: input.batchId ?? null,
    imageIds: Array.isArray(input.imageIds) ? input.imageIds : [],
    data,
  };
}
