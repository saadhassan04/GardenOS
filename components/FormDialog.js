/**
 * Generic form dialog (UI layer, L5).
 * Declarative small forms in a native <dialog> — used by locations, pest
 * reporting, and treatment flows. For anything bigger than ~6 fields,
 * build a page instead (forms deserve room — UI_GUIDELINES.md §7).
 */

import { localDateString } from '../utils/dates.js';
import { el } from '../utils/dom.js';

/**
 * @typedef {object} FieldSpec
 * @property {string} name key in the resolved values object
 * @property {string} label
 * @property {'text'|'textarea'|'select'|'date'|'number'} [kind] default 'text'
 * @property {[string, string][]} [options] for kind 'select'
 * @property {string} [value] initial value
 * @property {boolean} [required]
 * @property {string} [placeholder]
 * @property {string[]} [suggestions] datalist entries for kind 'text'
 * @property {string} [hint]
 * @property {boolean} [allowFuture] date fields clamp to today (backdating)
 *   unless this is set — due dates need tomorrow
 */

/**
 * @param {{title: string, fields: FieldSpec[], submitLabel?: string,
 *          intro?: string}} options
 * @returns {Promise<Record<string, string>|null>} field values, or null on cancel
 */
export function formDialog({ title, fields, submitLabel = 'Save', intro = null }) {
  return new Promise((resolve) => {
    const controls = {};

    const fieldNodes = fields.map((spec) => {
      const id = `fd-${spec.name}`;
      let control;
      if (spec.kind === 'select') {
        control = el(
          'select',
          { className: 'field__control', id },
          ...(spec.options ?? []).map(([value, text]) => el('option', { value }, text)),
        );
        control.value = spec.value ?? spec.options?.[0]?.[0] ?? '';
      } else if (spec.kind === 'textarea') {
        control = el('textarea', { className: 'field__control field__control--area', id, rows: '2' }, spec.value ?? '');
      } else {
        control = el('input', {
          className: 'field__control',
          id,
          type: spec.kind === 'date' ? 'date' : spec.kind === 'number' ? 'number' : 'text',
          value: spec.value ?? '',
          placeholder: spec.placeholder ?? null,
        });
        if (spec.kind === 'date' && !spec.allowFuture) {
          control.setAttribute('max', localDateString());
        }
        if (spec.kind === 'number') {
          control.setAttribute('min', '0');
          control.setAttribute('step', 'any');
          control.setAttribute('inputmode', 'decimal');
        }
      }
      if (spec.required) {
        control.setAttribute('required', '');
      }
      controls[spec.name] = control;

      const parts = [el('label', { className: 'field__label', for: id }, spec.label), control];
      if (spec.suggestions?.length) {
        const listId = `${id}-list`;
        control.setAttribute('list', listId);
        parts.push(el('datalist', { id: listId }, ...spec.suggestions.map((s) => el('option', { value: s }))));
      }
      if (spec.hint) {
        parts.push(el('span', { className: 'field__hint' }, spec.hint));
      }
      return el('div', { className: 'field' }, ...parts);
    });

    const dialog = el(
      'dialog',
      { className: 'dialog', 'aria-labelledby': 'fd-title' },
      el('h3', { className: 'dialog__title', id: 'fd-title' }, title),
      intro ? el('p', { className: 'text-small text-muted' }, intro) : null,
      el(
        'form',
        {
          className: 'stack',
          onSubmit: (event) => {
            event.preventDefault();
            close(Object.fromEntries(
              Object.entries(controls).map(([name, control]) => [name, control.value]),
            ));
          },
        },
        ...fieldNodes,
        el(
          'div',
          { className: 'dialog__actions' },
          el('button', { className: 'btn', type: 'button', onClick: () => close(null) }, 'Cancel'),
          el('button', { className: 'btn btn--primary', type: 'submit' }, submitLabel),
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
