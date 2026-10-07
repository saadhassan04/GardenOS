/**
 * Dashboard page (UI layer, L5) — FR-8, T-070/T-071.
 * Renders the widget registry in the user's order; widgets re-render live
 * on their declared bus topics. Customize = toggle + reorder, persisted
 * via settings (FR-8.2). Widgets themselves live in widgets/ — this page
 * knows none of them by name.
 */

import { el, svgIcon, clear } from '../utils/dom.js';
import { bus } from '../hooks/bus.js';
import { showToast } from '../components/Toast.js';
import { logger } from '../utils/logger.js';
import { getActiveWidgets, getWidgetSettings, saveLayout } from '../widgets/registry.js';

/** Bus unsubscribers for the currently mounted dashboard. */
let activeUnsubs = [];

function teardown() {
  for (const unsub of activeUnsubs) {
    unsub();
  }
  activeUnsubs = [];
}

/** @returns {HTMLElement} */
export function renderDashboardPage() {
  teardown(); // a previous dashboard render may still hold subscriptions

  const page = el('div', {});
  build(page);

  // Leaving the dashboard releases every widget subscription.
  activeUnsubs.push(
    bus.on('route:changed', ({ path }) => {
      if (path !== '/dashboard') {
        teardown();
      }
    }),
  );

  return page;
}

function build(page) {
  clear(page);
  page.append(
    el(
      'header',
      { className: 'page-header page-header--split' },
      el('h1', {}, 'Dashboard'),
      el(
        'button',
        { className: 'btn', onClick: () => customizeFlow(() => { teardown(); build(page); }) },
        'Customize',
      ),
    ),
  );

  const grid = el('div', { className: 'widget-grid' });
  page.append(grid);

  const widgets = getActiveWidgets();
  if (widgets.length === 0) {
    grid.append(
      el('div', { className: 'card empty-state' }, el('p', {}, 'Every widget is hidden. Customize to bring them back.')),
    );
    return;
  }

  for (const spec of widgets) {
    const body = el('div', { className: 'widget__body' });
    grid.append(
      el(
        'section',
        { className: `card widget${spec.wide ? ' widget--wide' : ''}` },
        el('span', { className: 'text-caption' }, spec.title),
        body,
      ),
    );

    const paint = async () => {
      clear(body);
      try {
        await spec.render(body);
      } catch (error) {
        logger.error(`Widget "${spec.id}" failed to render`, { error: error.message });
        body.append(el('p', { className: 'text-small text-muted' }, `Unavailable: ${error.message}`));
      }
    };
    paint();
    for (const topic of spec.refreshOn ?? []) {
      activeUnsubs.push(bus.on(topic, paint));
    }
  }
}

/**
 * Toggle/reorder dialog (FR-8.2). Order changes move rows up/down; the
 * result persists as {order, disabled} in settings.
 */
function customizeFlow(rebuild) {
  const entries = getWidgetSettings().map(({ spec, enabled }) => ({ spec, enabled }));

  const list = el('div', { className: 'stack' });

  const renderList = () => {
    clear(list);
    entries.forEach((entry, index) => {
      const checkbox = el('input', {
        type: 'checkbox',
        id: `w-${entry.spec.id}`,
        onChange: (event) => {
          entry.enabled = event.target.checked;
        },
      });
      checkbox.checked = entry.enabled;

      const move = (delta) => {
        const target = index + delta;
        if (target < 0 || target >= entries.length) {
          return;
        }
        [entries[index], entries[target]] = [entries[target], entries[index]];
        renderList();
      };

      list.append(
        el(
          'div',
          { className: 'status-row' },
          el(
            'span',
            { className: 'more-entry__body' },
            checkbox,
            el('label', { for: `w-${entry.spec.id}` }, entry.spec.title),
          ),
          el(
            'span',
            { className: 'dialog__actions' },
            el('button', { className: 'btn note-card__pin', 'aria-label': `Move ${entry.spec.title} up`, onClick: () => move(-1) }, '↑'),
            el('button', { className: 'btn note-card__pin', 'aria-label': `Move ${entry.spec.title} down`, onClick: () => move(1) }, '↓'),
          ),
        ),
      );
    });
  };
  renderList();

  const dialog = el(
    'dialog',
    { className: 'dialog', 'aria-label': 'Customize dashboard' },
    el('h3', { className: 'dialog__title' }, 'Customize dashboard'),
    list,
    el(
      'div',
      { className: 'dialog__actions' },
      el('button', { className: 'btn', onClick: () => close() }, 'Cancel'),
      el(
        'button',
        {
          className: 'btn btn--primary',
          onClick: () => {
            saveLayout({
              order: entries.map((entry) => entry.spec.id),
              disabled: entries.filter((entry) => !entry.enabled).map((entry) => entry.spec.id),
            });
            close();
            showToast('Dashboard updated');
            rebuild();
          },
        },
        svgIcon('gear', { size: 18 }),
        'Save layout',
      ),
    ),
  );

  const close = () => {
    dialog.close();
    dialog.remove();
  };
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  document.body.append(dialog);
  dialog.showModal();
}
