/**
 * Garden note model (Data layer, L2) — DATABASE.md §3.4, FR-7.
 * Notes are free-form: a title is required, everything else optional.
 * Tags are normalized (lowercase, trimmed, unique); pinned is stored as
 * 0/1 because the field is indexed (DATABASE.md §5).
 */

import { ValidationError } from '../utils/errors.js';

/**
 * Validate and normalize note input.
 * @param {object} input
 * @returns {object} complete note body (envelope excluded)
 * @throws {ValidationError}
 */
export function validateNote(input) {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Note input must be an object');
  }

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) {
    throw new ValidationError('A note needs a title');
  }

  const plantIds = Array.isArray(input.plantIds)
    ? input.plantIds.filter((id) => typeof id === 'string' && id.length > 0)
    : [];

  const tags = Array.isArray(input.tags)
    ? [...new Set(input.tags
        .filter((tag) => typeof tag === 'string')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean))]
    : [];

  return {
    title,
    body: typeof input.body === 'string' ? input.body.trim() : '',
    plantIds,
    imageIds: Array.isArray(input.imageIds) ? input.imageIds : [],
    tags,
    pinned: input.pinned ? 1 : 0,
  };
}
