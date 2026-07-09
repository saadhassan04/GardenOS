/**
 * Notes service (Business layer, L3) — API_DESIGN.md §2, FR-7, T-037.
 * Note lifecycle plus the client-side search across title, body, and tags.
 */

import { validateNote } from '../models/Note.js';
import { noteRepository } from '../database/NoteRepository.js';
import { bus } from '../hooks/bus.js';
import { NotFoundError } from '../utils/errors.js';

/** @param {object} input @returns {Promise<object>} */
export async function createNote(input) {
  const note = await noteRepository.add(validateNote(input));
  bus.emit('note:created', { noteId: note.id });
  return note;
}

/**
 * Merge-edit; the merged record is re-validated as a whole.
 * @param {string} noteId @param {object} patch
 */
export async function updateNote(noteId, patch) {
  const existing = await noteRepository.get(noteId);
  if (!existing) {
    throw new NotFoundError('That note no longer exists');
  }
  const updated = await noteRepository.update(noteId, validateNote({ ...existing, ...patch }));
  bus.emit('note:updated', { noteId });
  return updated;
}

/** Soft delete — recoverable until tombstone purge. @param {string} noteId */
export async function deleteNote(noteId) {
  await noteRepository.softDelete(noteId);
  bus.emit('note:deleted', { noteId });
}

/** @param {string} noteId @returns {Promise<object|null>} */
export function getNote(noteId) {
  return noteRepository.get(noteId);
}

/**
 * Shaped note list: pinned first, then most recently updated; filtered by
 * free-text search (title/body/tags), tag, and/or linked plant.
 * @param {{search?: string, tag?: string|null, plantId?: string|null}} [options]
 * @returns {Promise<object[]>}
 */
export async function listNotes({ search = '', tag = null, plantId = null } = {}) {
  let notes = await noteRepository.listRecent();

  if (plantId) {
    notes = notes.filter((note) => note.plantIds.includes(plantId));
  }
  if (tag) {
    notes = notes.filter((note) => note.tags.includes(tag.toLowerCase()));
  }
  const needle = search.trim().toLowerCase();
  if (needle) {
    notes = notes.filter(
      (note) =>
        note.title.toLowerCase().includes(needle)
        || note.body.toLowerCase().includes(needle)
        || note.tags.some((t) => t.includes(needle)),
    );
  }

  // Pinned first, then recency; title tiebreak keeps same-millisecond
  // records (bulk imports) deterministic.
  const byRecency = (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title);
  return [...notes.filter((n) => n.pinned).sort(byRecency), ...notes.filter((n) => !n.pinned).sort(byRecency)];
}

/** @param {string} noteId @returns {Promise<object>} the updated note */
export async function togglePin(noteId) {
  const note = await noteRepository.get(noteId);
  if (!note) {
    throw new NotFoundError('That note no longer exists');
  }
  return updateNote(noteId, { pinned: note.pinned ? 0 : 1 });
}
