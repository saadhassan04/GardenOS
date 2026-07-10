/**
 * More page (UI layer, L5) — UI_GUIDELINES.md §6.
 * The hub for everything that doesn't earn a primary navigation slot:
 * notes, locations, settings, diagnostics. Keeps the bottom bar at five.
 */

import { el, svgIcon } from '../utils/dom.js';

const ENTRIES = [
  { label: 'Notes', hint: 'Garden journal, tags, plant links', path: '/notes', icon: 'note' },
  { label: 'Locations', hint: 'Balconies, rooftop, beds', path: '/locations', icon: 'home' },
  { label: 'Settings', hint: 'Theme, backup & restore, storage', path: '/settings', icon: 'gear' },
  { label: 'Diagnostics', hint: 'Database, migrations, session log', path: '/diagnostics', icon: 'spray' },
];

/** @returns {HTMLElement} */
export function renderMorePage() {
  return el(
    'div',
    {},
    el('header', { className: 'page-header' }, el('h1', {}, 'More')),
    el(
      'div',
      { className: 'stack' },
      ...ENTRIES.map((entry) =>
        el(
          'a',
          { className: 'card note-card__head more-entry', href: `#${entry.path}` },
          el(
            'div',
            { className: 'more-entry__body' },
            svgIcon(entry.icon, { size: 24, className: 'timeline__icon' }),
            el(
              'div',
              {},
              el('h3', { className: 'plant-card__name' }, entry.label),
              el('p', { className: 'text-small text-muted' }, entry.hint),
            ),
          ),
          el('span', { className: 'text-muted' }, '›'),
        ),
      ),
    ),
  );
}
