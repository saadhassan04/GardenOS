/**
 * Plant card (UI layer, L5) — UI_GUIDELINES.md §7 Cards.
 * List representation of one plant: photo slot (cover images arrive v1.2),
 * name, category chip, and last-watered freshness text. Profile-driven
 * freshness colors arrive with care profiles (TODO T-039).
 */

import { el, svgIcon } from '../utils/dom.js';
import { relativeDate } from '../utils/dates.js';
import { PLANT_CATEGORIES } from '../config/registries.js';

/**
 * @param {object} plant
 * @param {{selectable?: boolean, selected?: boolean, onToggle?: (id: string) => void}} [options]
 *   In selectable mode the card becomes a toggle (bulk logging, US-A2)
 *   instead of a navigation link.
 * @returns {HTMLElement}
 */
export function renderPlantCard(plant, options = {}) {
  const { selectable = false, selected = false, onToggle } = options;

  const props = selectable
    ? {
        className: `plant-card plant-card--selectable${selected ? ' plant-card--selected' : ''}`,
        role: 'checkbox',
        tabindex: '0',
        'aria-checked': selected ? 'true' : 'false',
        'aria-label': `Select ${plant.name}`,
        onClick: () => onToggle(plant.id),
        onKeydown: (event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            onToggle(plant.id);
          }
        },
      }
    : { className: 'plant-card', href: `#/plants/${plant.id}` };

  const card = el(
    selectable ? 'div' : 'a',
    props,
    el('div', { className: 'plant-card__photo' }, svgIcon('leaf', { size: 32 })),
    el(
      'div',
      { className: 'plant-card__body' },
      el('h3', { className: 'plant-card__name' }, plant.name),
      plant.botanicalName
        ? el('p', { className: 'text-small text-muted plant-card__botanical' }, plant.botanicalName)
        : null,
      el(
        'div',
        { className: 'plant-card__meta' },
        plant.category
          ? el('span', { className: 'chip' }, PLANT_CATEGORIES[plant.category]?.label ?? plant.category)
          : null,
        el(
          'span',
          { className: 'text-small text-muted' },
          plant.derived.lastWateredAt
            ? `Watered ${relativeDate(plant.derived.lastWateredAt)}`
            : 'Not watered yet',
        ),
      ),
    ),
  );
  return card;
}
