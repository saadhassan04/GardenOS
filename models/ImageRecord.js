/**
 * Image record model (Data layer, L2) — DATABASE.md §3.5, FR-6.
 * The full-resolution blob lives on the record; its thumbnail lives in the
 * separate `thumbnails` store so galleries never touch full blobs.
 */

import { ValidationError } from '../utils/errors.js';

/**
 * @param {object} input
 * @returns {object} complete image record body (envelope excluded)
 * @throws {ValidationError}
 */
export function validateImageRecord(input) {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Image input must be an object');
  }
  if (!(input.blob instanceof Blob) || input.blob.size === 0) {
    throw new ValidationError('An image record needs a non-empty blob');
  }
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(capturedAt))) {
    throw new ValidationError('Image capturedAt is not a valid timestamp');
  }
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height)) {
    throw new ValidationError('An image record needs pixel dimensions');
  }

  return {
    blob: input.blob,
    mimeType: input.blob.type,
    width: input.width,
    height: input.height,
    byteSize: input.blob.size,
    capturedAt: new Date(capturedAt).toISOString(),
    plantId: input.plantId ?? null,
    eventId: input.eventId ?? null,
    noteId: input.noteId ?? null,
    caption: (input.caption ?? '').trim(),
    tags: Array.isArray(input.tags) ? input.tags : [],
  };
}
