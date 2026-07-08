/**
 * DOM construction helpers (Platform layer, L1).
 * Components build real DOM nodes with these — never innerHTML with user
 * data (ARCHITECTURE.md §13, CONTRIBUTING.md §3). ~The framework we own.
 */

/**
 * Create an element.
 * @param {string} tag
 * @param {object} [props] className, attributes, dataset, and on* listeners.
 *   Keys starting with "on" attach listeners; "dataset" merges data-attrs;
 *   "aria" keys and other attributes are set via setAttribute.
 * @param {...(Node|string|null|undefined)} children strings become text nodes;
 *   null/undefined children are skipped.
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (key === 'className') {
      node.className = value;
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'text') {
      node.textContent = value;
    } else {
      node.setAttribute(key, value);
    }
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined) {
      continue;
    }
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}

/**
 * Reference an icon from the SVG sprite (assets/icons/sprite.svg).
 * @param {string} name symbol id within the sprite
 * @param {{size?: number, className?: string, label?: string}} [options]
 *   Provide `label` for functional icons; omit for decorative (aria-hidden).
 * @returns {SVGSVGElement}
 */
export function svgIcon(name, options = {}) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const size = options.size ?? 24;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  if (options.className) {
    svg.setAttribute('class', options.className);
  }
  if (options.label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', options.label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `assets/icons/sprite.svg#${name}`);
  svg.append(use);
  return svg;
}

/**
 * Remove all children of a node.
 * @param {HTMLElement} node
 */
export function clear(node) {
  node.replaceChildren();
}
