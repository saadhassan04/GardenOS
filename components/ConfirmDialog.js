/**
 * Confirmation dialog (UI layer, L5) — UI_GUIDELINES.md §7 Feedback.
 * Destructive actions always confirm, naming what they affect. Built on the
 * native <dialog> element: modal focus trap, Escape handling, and backdrop
 * come from the platform.
 */

import { el } from '../utils/dom.js';

/**
 * Ask the user to confirm an action.
 * @param {{title: string, body: string, confirmLabel?: string,
 *          cancelLabel?: string, danger?: boolean}} options
 * @returns {Promise<boolean>} true only on explicit confirmation
 */
export function confirmDialog({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
}) {
  return new Promise((resolve) => {
    const dialog = el(
      'dialog',
      { className: 'dialog', 'aria-labelledby': 'dialog-title' },
      el('h3', { className: 'dialog__title', id: 'dialog-title' }, title),
      el('p', { className: 'text-muted' }, body),
      el(
        'div',
        { className: 'dialog__actions' },
        el('button', { className: 'btn', onClick: () => close(false) }, cancelLabel),
        el(
          'button',
          { className: `btn ${danger ? 'btn--danger' : 'btn--primary'}` , onClick: () => close(true) },
          confirmLabel,
        ),
      ),
    );

    const close = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    // Escape key: treat exactly like Cancel so the promise always settles.
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close(false);
    });

    document.body.append(dialog);
    dialog.showModal();
  });
}
