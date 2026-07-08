/**
 * Hash-based SPA router (Application layer, L4) — ARCHITECTURE.md D6.
 * Modules register routes; the router renders the matching page into the
 * outlet. Every screen is deep-linkable; the back button behaves natively.
 */

import { bus } from './bus.js';
import { clear } from '../utils/dom.js';
import { logger } from '../utils/logger.js';
import { APP_NAME } from '../config/constants.js';

/** @type {{segments: string[], handler: RouteHandler, title: string}[]} */
const routes = [];

/** @type {RouteHandler|null} */
let notFoundHandler = null;

/** @type {HTMLElement|null} */
let outlet = null;

/**
 * @callback RouteHandler
 * @param {{params: Record<string, string>}} context
 * @returns {HTMLElement|Promise<HTMLElement>} the page root node
 */

/**
 * Register a route.
 * @param {string} pattern e.g. "/", "/settings", "/plants/:id"
 * @param {string} title document title suffix for the screen
 * @param {RouteHandler} handler
 */
export function registerRoute(pattern, title, handler) {
  routes.push({ segments: toSegments(pattern), handler, title });
}

/** @param {RouteHandler} handler page rendered when no route matches */
export function setNotFound(handler) {
  notFoundHandler = handler;
}

/**
 * Start routing into the given outlet and render the current hash.
 * @param {HTMLElement} outletEl
 */
export function startRouter(outletEl) {
  outlet = outletEl;
  window.addEventListener('hashchange', render);
  render();
}

/** @param {string} path e.g. "/settings" */
export function navigate(path) {
  window.location.hash = `#${path}`;
}

/** @returns {string} current path, e.g. "/settings" */
export function currentPath() {
  const hash = window.location.hash || '#/';
  return hash.startsWith('#') ? hash.slice(1) : hash;
}

function toSegments(path) {
  return path.split('/').filter(Boolean);
}

/**
 * @param {string[]} patternSegments
 * @param {string[]} pathSegments
 * @returns {Record<string, string>|null} params on match, null otherwise
 */
function match(patternSegments, pathSegments) {
  if (patternSegments.length !== pathSegments.length) {
    return null;
  }
  const params = {};
  for (let i = 0; i < patternSegments.length; i += 1) {
    const patternSegment = patternSegments[i];
    if (patternSegment.startsWith(':')) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegments[i]);
    } else if (patternSegment !== pathSegments[i]) {
      return null;
    }
  }
  return params;
}

async function render() {
  if (!outlet) {
    return;
  }
  const path = currentPath();
  const pathSegments = toSegments(path);

  let matched = null;
  let params = null;
  for (const route of routes) {
    params = match(route.segments, pathSegments);
    if (params) {
      matched = route;
      break;
    }
  }

  try {
    const page = matched
      ? await matched.handler({ params })
      : await notFoundHandler({ params: {} });
    clear(outlet);
    outlet.append(page);
    document.title = matched ? `${matched.title} · ${APP_NAME}` : APP_NAME;
    // Move focus to the content region so screen readers announce the new
    // screen and keyboard users start at the top (UI_GUIDELINES.md §10).
    outlet.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    bus.emit('route:changed', { path });
  } catch (error) {
    logger.error(`Failed to render route "${path}"`, { error: error.message });
    throw error;
  }
}
