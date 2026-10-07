/**
 * Event form dialog (UI layer, L5) — FR-2.3 (backdating), FR-3.1.
 * Full event entry beyond one-tap quick logs: choose the event type, the
 * date (today by default, never the future), and an optional note. Used by
 * the plant detail page (single plant) and the bulk-logging flow.
 */

import { el } from '../utils/dom.js';
import { EVENT_TYPES } from '../config/registries.js';
import { localDateString, dateToOccurredAt } from '../utils/dates.js';

/**
 * @param {{title: string, defaultType?: string}} options
 * @returns {Promise<null|{type: string, occurredAt: string, data: object}>}
 *   null when cancelled
 */
export function eventFormDialog({ title, defaultType = 'watering' }) {
  return new Promise((resolve) => {
    const today = localDateString(new Date());

    const typeSelect = el(
      'select',
      { className: 'field__control', id: 'event-type' },
      ...Object.entries(EVENT_TYPES).map(([key, spec]) => el('option', { value: key }, spec.label)),
    );
    typeSelect.value = defaultType;

    const dateInput = el('input', {
      className: 'field__control',
      id: 'event-date',
      type: 'date',
      value: today,
      max: today,
    });

    const noteInput = el('textarea', {
      className: 'field__control field__control--area',
      id: 'event-note',
      rows: '2',
      placeholder: 'Optional note…',
    });

    const dialog = el(
      'dialog',
      { className: 'dialog', 'aria-labelledby': 'event-dialog-title' },
      el('h3', { className: 'dialog__title', id: 'event-dialog-title' }, title),
      el(
        'form',
        {
          className: 'stack',
          onSubmit: (event) => {
            event.preventDefault();
            close({
              type: typeSelect.value,
              occurredAt: dateToOccurredAt(dateInput.value, today),
              data: noteInput.value.trim() ? { note: noteInput.value.trim() } : {},
            });
          },
        },
        field('Event', 'event-type', typeSelect),
        field('Date', 'event-date', dateInput),
        field('Note', 'event-note', noteInput),
        el(
          'div',
          { className: 'dialog__actions' },
          el('button', { className: 'btn', type: 'button', onClick: () => close(null) }, 'Cancel'),
          el('button', { className: 'btn btn--primary', type: 'submit' }, 'Log it'),
        ),
      ),
    );

    const close = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close(null);
    });

    document.body.append(dialog);
    dialog.showModal();
  });
}

function field(label, id, control) {
  return el('div', { className: 'field' }, el('label', { className: 'field__label', for: id }, label), control);
}
