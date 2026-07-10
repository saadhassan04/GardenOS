/**
 * Dashboard widget registry (UI layer, L5) — ARCHITECTURE.md §7, FR-8.2.
 * Widgets self-register at bootstrap (widgets/index.js); the dashboard
 * renders whatever is registered, in the user's persisted order, with
 * user-disabled widgets skipped. Adding a widget never touches dashboard
 * code (Open/Closed).
 */

import { getSetting, setSetting } from '../storage/settings.js';
import { ValidationError } from '../utils/errors.js';

/**
 * @typedef {object} WidgetSpec
 * @property {string} id stable identifier (persisted in layout)
 * @property {string} title section caption
 * @property {number} defaultOrder lower renders first
 * @property {boolean} [wide] spans the full grid width
 * @property {(container: HTMLElement) => void|Promise<void>} render
 * @property {string[]} [refreshOn] bus topics that re-render this widget
 */

/** @type {Map<string, WidgetSpec>} */
const registry = new Map();

/** @param {WidgetSpec} spec */
export function registerWidget(spec) {
  if (!spec?.id || typeof spec.render !== 'function') {
    throw new ValidationError('A widget needs an id and a render function');
  }
  if (registry.has(spec.id)) {
    throw new ValidationError(`Widget "${spec.id}" is already registered`);
  }
  registry.set(spec.id, spec);
}

/**
 * Widgets to display, in effective order (user layout over defaults).
 * @returns {WidgetSpec[]}
 */
export function getActiveWidgets() {
  const layout = getSetting('dashboardLayout');
  const disabled = new Set(layout?.disabled ?? []);
  const order = layout?.order ?? [];
  const position = (spec) => {
    const index = order.indexOf(spec.id);
    return index === -1 ? 1000 + spec.defaultOrder : index;
  };
  return [...registry.values()]
    .filter((spec) => !disabled.has(spec.id))
    .sort((a, b) => position(a) - position(b));
}

/** Every registered widget in effective order, with its enabled state. */
export function getWidgetSettings() {
  const layout = getSetting('dashboardLayout');
  const disabled = new Set(layout?.disabled ?? []);
  const order = layout?.order ?? [];
  const position = (spec) => {
    const index = order.indexOf(spec.id);
    return index === -1 ? 1000 + spec.defaultOrder : index;
  };
  return [...registry.values()]
    .sort((a, b) => position(a) - position(b))
    .map((spec) => ({ spec, enabled: !disabled.has(spec.id) }));
}

/**
 * Persist the user's layout (FR-8.2).
 * @param {{order: string[], disabled: string[]}} layout
 */
export function saveLayout(layout) {
  setSetting('dashboardLayout', {
    order: layout.order.filter((id) => registry.has(id)),
    disabled: layout.disabled.filter((id) => registry.has(id)),
  });
}

/** Test hook: a fresh registry between suites. */
export function _resetRegistryForTests() {
  registry.clear();
}
