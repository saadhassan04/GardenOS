/**
 * Quick actions widget (UI layer, L5) — FR-8.1 quick-log shortcuts.
 * The daily entry points, one tap from the dashboard.
 */

import { el, svgIcon } from '../utils/dom.js';
import { registerWidget } from './registry.js';

const SHORTCUTS = [
  { label: 'Water plants', path: '/plants', icon: 'drop' },
  { label: 'Add photo', path: '/gallery', icon: 'camera' },
  { label: 'New sowing', path: '/kitchen', icon: 'basket' },
  { label: 'New note', path: '/notes/new', icon: 'note' },
];

registerWidget({
  id: 'quickLog',
  title: 'Quick actions',
  defaultOrder: 2,
  render(container) {
    container.append(
      el(
        'div',
        { className: 'quick-log' },
        ...SHORTCUTS.map((shortcut) =>
          el(
            'a',
            { className: 'btn quick-log__btn', href: `#${shortcut.path}` },
            svgIcon(shortcut.icon, { size: 20 }),
            shortcut.label,
          ),
        ),
      ),
    );
  },
});
