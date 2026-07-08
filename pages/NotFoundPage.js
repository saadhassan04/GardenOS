/**
 * Not-found page (UI layer, L5).
 * Rendered by the router when no registered route matches the hash.
 */

import { el } from '../utils/dom.js';

/** @returns {HTMLElement} */
export function renderNotFoundPage() {
  return el(
    'div',
    {},
    el('header', { className: 'page-header' }, el('h1', {}, 'Nothing growing here')),
    el(
      'section',
      { className: 'card' },
      el('p', { className: 'text-muted' }, 'That screen does not exist (yet).'),
      el('p', {}, el('a', { href: '#/' }, 'Back to the Dashboard')),
    ),
  );
}
