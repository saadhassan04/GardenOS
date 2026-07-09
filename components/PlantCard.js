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
 * @returns {HTMLElement} an anchor card linking to the plant detail page
 */
export function renderPlantCard(plant) {
  const card = el(
    'a',
    { className: 'plant-card', href: `#/plants/${plant.id}` },
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
