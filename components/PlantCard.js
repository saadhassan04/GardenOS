/**
 * Plant card (UI layer, L5) — UI_GUIDELINES.md §7 Cards, PHASE2_HANDOFF §6
 * step 5. A compact list row for phone use: thumbnail, name (+ active-pest
 * dot), "next water · last fed" line, and a one-tap water button on the
 * right. The schedule is resolved by the caller (careProfileService) so a
 * list renders with one profile read for the whole page.
 */

import { el, svgIcon } from '../utils/dom.js';
import { relativeDate } from '../utils/dates.js';
import { thumbnailUrl } from '../services/imageService.js';

/**
 * @param {object} plant
 * @param {{selectable?: boolean, selected?: boolean, onToggle?: (id: string) => void,
 *   schedule?: object|null, hasPest?: boolean, onLogWatering?: (plant: object) => void}} [options]
 *   `schedule` comes from careProfileService.wateringSchedule; null means the
 *   interval is unknown, which the row states plainly instead of inventing a
 *   date. In selectable mode the row becomes a toggle (bulk logging, US-A2)
 *   and the water button is withheld — a button inside a toggle would fight
 *   it for the tap.
 * @returns {HTMLElement}
 */
export function renderPlantCard(plant, options = {}) {
  const { selectable = false, selected = false, onToggle, schedule = null, hasPest = false, onLogWatering = null } = options;

  const contents = [renderThumb(plant), renderBody(plant, schedule, hasPest)];
  const edge = schedule && wateringState(schedule) !== 'ok' ? ` plant-card--${wateringState(schedule)}` : '';

  if (selectable) {
    return el(
      'div',
      {
        className: `plant-card plant-card--selectable${selected ? ' plant-card--selected' : ''}${edge}`,
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
      },
      ...contents,
    );
  }

  // The link wraps only thumb + body: a <button> inside an <a> is invalid,
  // and its tap would navigate instead of logging.
  return el(
    'article',
    { className: `plant-card${edge}` },
    el('a', { className: 'plant-card__link', href: `#/plants/${plant.id}` }, ...contents),
    onLogWatering && schedule
      ? el(
        'button',
        {
          className: 'btn btn--ghost plant-card__log',
          type: 'button',
          'aria-label': `Log watering for ${plant.name}`,
          onClick: () => onLogWatering(plant),
        },
        svgIcon('drop', { size: 20 }),
      )
      : null,
  );
}

/** Small cover thumbnail; the leaf placeholder stays until (unless) it loads. */
function renderThumb(plant) {
  const thumb = el('div', { className: 'plant-card__thumb' }, svgIcon('leaf', { size: 24 }));
  if (plant.coverImageId) {
    thumbnailUrl(plant.coverImageId).then((url) => {
      if (url) {
        thumb.replaceChildren(el('img', { className: 'plant-card__cover', src: url, alt: '', loading: 'lazy' }));
      }
    });
  }
  return thumb;
}

function renderBody(plant, schedule, hasPest) {
  const fed = plant.derived?.lastFertilizedAt;
  const state = schedule ? wateringState(schedule) : null;
  return el(
    'div',
    { className: 'plant-card__body' },
    el(
      'h3',
      { className: 'plant-card__name' },
      plant.name,
      hasPest ? el('span', { className: 'pest-dot', role: 'img', 'aria-label': 'Active pest or disease' }) : null,
    ),
    el(
      'p',
      { className: 'text-small text-muted' },
      schedule
        ? el('span', { className: state === 'ok' ? '' : `plant-card__due--${state}` }, dueText(schedule))
        : (plant.derived?.lastWateredAt ? `No schedule · watered ${relativeDate(plant.derived.lastWateredAt)}` : 'No schedule set'),
      fed ? ` · fed ${relativeDate(fed)}` : null,
    ),
  );
}

/**
 * Urgency band, always paired with text (WCAG 2.1 AA).
 * @returns {'overdue'|'due'|'ok'}
 */
function wateringState({ daysUntil, neverWatered }) {
  if (neverWatered) {
    return 'ok'; // unknown history is not an alarm (matches Today, D2)
  }
  if (daysUntil < 0) {
    return 'overdue';
  }
  return daysUntil === 0 ? 'due' : 'ok';
}

function dueText({ daysUntil, neverWatered }) {
  if (neverWatered) {
    return 'Not watered yet';
  }
  if (daysUntil < 0) {
    return `Water: ${Math.abs(daysUntil)}d overdue`;
  }
  return daysUntil === 0 ? 'Water today' : `Water in ${daysUntil}d`;
}
