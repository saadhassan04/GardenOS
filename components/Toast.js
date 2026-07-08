/**
 * Toast notifications (UI layer, L5) — UI_GUIDELINES.md §7 Feedback.
 * Bottom-anchored, auto-dismissing, with an optional action slot (Undo,
 * Reload…). The #toast-region container is aria-live="polite" in index.html.
 */

import { el } from '../utils/dom.js';
import { TOAST_DURATION_MS } from '../config/constants.js';

/**
 * Show a toast.
 * @param {string} message short, concrete, gardener's vocabulary
 * @param {{actionLabel?: string, onAction?: () => void, sticky?: boolean}} [options]
 *   sticky toasts (e.g. "Update available") stay until acted on or dismissed.
 */
export function showToast(message, options = {}) {
  const region = document.getElementById('toast-region');
  if (!region) {
    return;
  }

  const toast = el('div', { className: 'toast' }, el('span', {}, message));

  const dismiss = () => toast.remove();

  if (options.actionLabel && options.onAction) {
    toast.append(
      el(
        'button',
        {
          className: 'btn btn--ghost toast__action',
          onClick: () => {
            options.onAction();
            dismiss();
          },
        },
        options.actionLabel,
      ),
    );
  }

  region.append(toast);

  if (!options.sticky) {
    window.setTimeout(dismiss, TOAST_DURATION_MS);
  }
}
