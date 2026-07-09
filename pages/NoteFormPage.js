/**
 * Note create/edit form (UI layer, L5) — FR-7.1, T-037.
 * Title required; body, tags (comma-separated), and linked plants optional.
 */

import { el } from '../utils/dom.js';
import { navigate } from '../hooks/router.js';
import { showToast } from '../components/Toast.js';
import { confirmDialog } from '../components/ConfirmDialog.js';
import { createNote, updateNote, deleteNote, getNote } from '../services/notesService.js';
import { listPlants } from '../services/plantService.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * @param {{params: {id?: string}}} context edit mode when params.id is set
 * @returns {Promise<HTMLElement>}
 */
export async function renderNoteFormPage({ params }) {
  const editing = Boolean(params.id);
  const note = editing ? await getNote(params.id) : null;
  if (editing && !note) {
    return el('div', { className: 'card' }, 'That note no longer exists. ', el('a', { href: '#/notes' }, 'Back to notes'));
  }

  const page = el('div', {});
  page.append(el('header', { className: 'page-header' }, el('h1', {}, editing ? 'Edit note' : 'Add note')));

  const titleInput = el('input', {
    className: 'field__control',
    id: 'note-title',
    type: 'text',
    required: '',
    value: note?.title ?? '',
  });
  const bodyInput = el(
    'textarea',
    { className: 'field__control field__control--area', id: 'note-body', rows: '6' },
    note?.body ?? '',
  );
  const tagsInput = el('input', {
    className: 'field__control',
    id: 'note-tags',
    type: 'text',
    placeholder: 'monsoon, fertilizer, balcony…',
    value: (note?.tags ?? []).join(', '),
  });

  // Native multi-select: keyboard-accessible everywhere; a chip picker can
  // replace it later without touching the service layer.
  const plants = await listPlants({ status: 'active' });
  const plantSelect = el(
    'select',
    { className: 'field__control field__control--multi', id: 'note-plants', multiple: '', size: '5' },
    ...plants.map((plant) => el('option', { value: plant.id }, plant.name)),
  );
  for (const option of plantSelect.options) {
    option.selected = note?.plantIds.includes(option.value) ?? false;
  }

  const form = el(
    'form',
    {
      className: 'card stack',
      onSubmit: async (event) => {
        event.preventDefault();
        const input = {
          title: titleInput.value,
          body: bodyInput.value,
          tags: tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean),
          plantIds: [...plantSelect.selectedOptions].map((option) => option.value),
        };
        try {
          const saved = editing ? await updateNote(note.id, input) : await createNote(input);
          showToast(editing ? 'Note updated' : `“${saved.title}” saved`);
          navigate('/notes');
        } catch (error) {
          if (error instanceof ValidationError) {
            showToast(error.message);
            titleInput.focus();
          } else {
            logger.error('Note save failed', { error: error.message });
            showToast(`Could not save: ${error.message}`);
          }
        }
      },
    },
    field('Title', 'note-title', titleInput),
    field('Note', 'note-body', bodyInput),
    field('Tags (comma-separated)', 'note-tags', tagsInput),
    field('Linked plants', 'note-plants', plantSelect, 'Hold Ctrl/Cmd to select several'),
    el(
      'div',
      { className: 'dialog__actions' },
      editing
        ? el(
            'button',
            {
              className: 'btn btn--danger',
              type: 'button',
              onClick: async () => {
                const ok = await confirmDialog({
                  title: `Delete “${note.title}”?`,
                  body: 'The note is removed from your lists (recoverable from a backup).',
                  confirmLabel: 'Delete note',
                  danger: true,
                });
                if (ok) {
                  await deleteNote(note.id);
                  showToast('Note deleted');
                  navigate('/notes');
                }
              },
            },
            'Delete',
          )
        : null,
      el('a', { className: 'btn', href: '#/notes' }, 'Cancel'),
      el('button', { className: 'btn btn--primary', type: 'submit' }, editing ? 'Save changes' : 'Add note'),
    ),
  );

  page.append(form);
  return page;
}

function field(label, id, control, hint = null) {
  return el(
    'div',
    { className: 'field' },
    el('label', { className: 'field__label', for: id }, label),
    control,
    hint ? el('span', { className: 'field__hint' }, hint) : null,
  );
}
