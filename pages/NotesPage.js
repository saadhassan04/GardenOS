/**
 * Notes page (UI layer, L5) — FR-7, T-037.
 * Pinned-first list with live search; each card opens its edit form.
 */

import { el, svgIcon, clear } from '../utils/dom.js';
import { listNotes, togglePin } from '../services/notesService.js';
import { relativeDate } from '../utils/dates.js';
import { logger } from '../utils/logger.js';
import { showToast } from '../components/Toast.js';

/** @returns {HTMLElement} */
export function renderNotesPage() {
  const page = el('div', {});
  const state = { search: '' };

  page.append(
    el(
      'header',
      { className: 'page-header page-header--split' },
      el('h1', {}, 'Notes'),
      el('a', { className: 'btn btn--primary', href: '#/notes/new' }, svgIcon('plus', { size: 20 }), 'Add note'),
    ),
  );

  page.append(
    el(
      'div',
      { className: 'filter-bar' },
      el('input', {
        className: 'field__control',
        type: 'search',
        placeholder: 'Search notes…',
        'aria-label': 'Search notes',
        onInput: (event) => {
          state.search = event.target.value;
          refresh();
        },
      }),
    ),
  );

  const listRegion = el('div', { className: 'stack' });
  page.append(listRegion);

  async function refresh() {
    try {
      const notes = await listNotes({ search: state.search });
      clear(listRegion);
      if (notes.length === 0) {
        listRegion.append(
          el(
            'div',
            { className: 'card empty-state' },
            el('p', {}, state.search ? 'No notes match that search.' : 'No notes yet.'),
            state.search ? null : el('a', { className: 'btn btn--primary', href: '#/notes/new' }, 'Write your first note'),
          ),
        );
        return;
      }
      listRegion.append(...notes.map((note) => noteCard(note, refresh)));
    } catch (error) {
      logger.error('Notes failed to load', { error: error.message });
      clear(listRegion);
      listRegion.append(el('div', { className: 'card' }, `Could not load notes: ${error.message}`));
    }
  }

  refresh();
  return page;
}

function noteCard(note, refresh) {
  const pinBtn = el(
    'button',
    {
      className: 'btn btn--ghost note-card__pin',
      'aria-label': note.pinned ? `Unpin ${note.title}` : `Pin ${note.title}`,
      'aria-pressed': note.pinned ? 'true' : 'false',
      onClick: async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await togglePin(note.id);
        showToast(note.pinned ? 'Unpinned' : 'Pinned to top');
        refresh();
      },
    },
    note.pinned ? '★' : '☆',
  );

  return el(
    'a',
    { className: 'card note-card', href: `#/notes/${note.id}/edit` },
    el(
      'div',
      { className: 'note-card__head' },
      el('h3', { className: 'plant-card__name' }, note.title),
      pinBtn,
    ),
    note.body ? el('p', { className: 'text-small text-muted note-card__body' }, note.body) : null,
    el(
      'div',
      { className: 'plant-card__meta' },
      ...note.tags.map((tag) => el('span', { className: 'chip' }, tag)),
      el('span', { className: 'text-small text-muted' }, `Updated ${relativeDate(note.updatedAt)}`),
    ),
  );
}
