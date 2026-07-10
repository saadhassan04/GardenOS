/**
 * Primary navigation (UI layer, L5) — UI_GUIDELINES.md §5–§6.
 * Bottom bar on mobile, sidebar on desktop (layout.css handles the switch).
 * Items are provided by the caller (app bootstrap now; module registry as
 * feature modules arrive) so this component never knows about features.
 */

import { el, svgIcon, clear } from '../utils/dom.js';
import { bus } from '../hooks/bus.js';
import { currentPath } from '../hooks/router.js';
import { APP_NAME } from '../config/constants.js';

/**
 * @typedef {object} NavItem
 * @property {string} label
 * @property {string} path route path, e.g. "/settings"
 * @property {string} icon sprite symbol id
 */

/**
 * Render navigation into the container and keep the active item in sync
 * with route changes.
 * @param {HTMLElement} container the <nav> landmark from index.html
 * @param {NavItem[]} items
 */
export function mountNavigation(container, items) {
  clear(container);

  container.append(
    el(
      'div',
      { className: 'nav-brand' },
      el('img', { src: 'assets/icons/icon.svg', alt: '' }),
      APP_NAME,
    ),
  );

  const links = items.map((item) =>
    el(
      'a',
      { className: 'nav-item', href: `#${item.path}` },
      svgIcon(item.icon, { className: 'nav-item__icon' }),
      el('span', {}, item.label),
    ),
  );
  container.append(...links);

  // Due-task count badge (FR-4.5 fallback inbox): rides the Tasks item.
  const tasksIndex = items.findIndex((item) => item.path === '/tasks');
  if (tasksIndex !== -1) {
    const badge = el('span', { className: 'nav-badge', hidden: '' });
    links[tasksIndex].append(badge);
    bus.on('tasks:badge', ({ count }) => {
      if (count > 0) {
        badge.textContent = String(count);
        badge.removeAttribute('hidden');
      } else {
        badge.setAttribute('hidden', '');
      }
    });
  }

  const syncActive = () => {
    const path = currentPath();
    items.forEach((item, index) => {
      const isActive =
        item.path === '/' ? path === '/' : path === item.path || path.startsWith(`${item.path}/`);
      if (isActive) {
        links[index].setAttribute('aria-current', 'page');
      } else {
        links[index].removeAttribute('aria-current');
      }
    });
  };

  bus.on('route:changed', syncActive);
  syncActive();
}
