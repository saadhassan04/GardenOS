/**
 * Plant card (UI layer, L5) — UI_GUIDELINES.md §7 Cards.
 * List representation of one plant: cover photo with a due badge, name,
 * botanical name, category, and the watering schedule — next-watering text
 * plus a cycle progress bar — with a one-tap log action. The schedule is
 * resolved by the caller (careProfileService) so a list renders it with one
 * profile read for the whole page rather than one per card.
 */

import { el, svgIcon } from '../utils/dom.js';
import { relativeDate } from '../utils/dates.js';
import { PLANT_CATEGORIES } from '../config/registries.js';
import { thumbnailUrl } from '../services/imageService.js';

/**
 * @param {object} plant
 * @param {{selectable?: boolean, selected?: boolean, onToggle?: (id: string) => void,
 *   schedule?: object|null, onLogWatering?: (plant: object) => void}} [options]
 *   `schedule` comes from careProfileService.wateringSchedule; null means the
 *   watering interval is unknown, which the card states plainly instead of
 *   inventing a date. In selectable mode the card becomes a toggle (bulk
 *   logging, US-A2) and the log action is withheld — bulk mode has its own
 *   action bar, and a button inside a toggle would fight it for the tap.
 * @returns {HTMLElement}
 */
export function renderPlantCard(plant, options = {}) {
  const {
    selectable = false,
    selected = false,
    onToggle,
    schedule = null,
    onLogWatering = null,
  } = options;

  const contents = [
    renderPhoto(plant, selectable ? null : schedule),
    renderBody(plant, schedule),
  ];

  if (selectable) {
    return el(
      'div',
      {
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
      },
      ...contents,
    );
  }

  // The link wraps only the photo and body: a <button> inside an <a> is
  // invalid, and its tap would navigate instead of logging.
  return el(
    'article',
    { className: 'plant-card' },
    el('a', { className: 'plant-card__link', href: `#/plants/${plant.id}` }, ...contents),
    onLogWatering && schedule ? renderLogAction(plant, onLogWatering) : null,
  );
}

/**
 * Cover photo frame; the badge sits outside the image slot so an async cover
 * landing (which replaces the slot's children) cannot wipe it.
 * @param {object} plant
 * @param {object|null} schedule
 * @returns {HTMLElement}
 */
function renderPhoto(plant, schedule) {
  const slot = el('div', { className: 'plant-card__photo-slot' }, svgIcon('leaf', { size: 32 }));
  if (plant.coverImageId) {
    // Async cover load; the leaf placeholder stays until (unless) it lands.
    thumbnailUrl(plant.coverImageId).then((url) => {
      if (url) {
        slot.replaceChildren(
          el('img', { className: 'plant-card__cover', src: url, alt: '', loading: 'lazy' }),
        );
      }
    });
  }

  return el(
    'div',
    { className: 'plant-card__photo' },
    slot,
    schedule ? renderBadge(schedule) : null,
  );
}

/**
 * @param {object} plant
 * @param {object|null} schedule
 * @returns {HTMLElement}
 */
function renderBody(plant, schedule) {
  return el(
    'div',
    { className: 'plant-card__body' },
    el('h3', { className: 'plant-card__name' }, plant.name),
    plant.botanicalName
      ? el('p', { className: 'text-small text-muted plant-card__botanical' }, plant.botanicalName)
      : null,
    renderSchedule(plant, schedule),
    plant.category
      ? el(
          'div',
          { className: 'plant-card__meta' },
          el('span', { className: 'chip' }, PLANT_CATEGORIES[plant.category]?.label ?? plant.category),
        )
      : null,
  );
}

/**
 * The next-watering block. With no resolvable interval it reports the
 * history we actually have and says so — never a guessed date (Plant
 * Knowledge Philosophy).
 * @param {object} plant
 * @param {object|null} schedule
 * @returns {HTMLElement}
 */
function renderSchedule(plant, schedule) {
  const caption = el('span', { className: 'text-caption' }, 'NEXT WATERING');

  if (!schedule) {
    const last = plant.derived?.lastWateredAt;
    return el(
      'div',
      { className: 'plant-card__schedule' },
      caption,
      el(
        'span',
        { className: 'text-small text-muted' },
        last ? `No schedule · watered ${relativeDate(last)}` : 'No schedule set',
      ),
    );
  }

  const state = wateringState(schedule);
  const percent = Math.round(schedule.elapsedRatio * 100);

  return el(
    'div',
    { className: 'plant-card__schedule' },
    caption,
    el('span', { className: `plant-card__due plant-card__due--${state}` }, dueText(schedule)),
    el(
      'div',
      {
        className: `progress progress--${state}`,
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': String(percent),
        'aria-label': `Watering cycle: ${dueText(schedule)}, watered every ${plural(schedule.everyDays, 'day')}`,
        style: `--progress: ${percent}%`,
      },
      el('div', { className: 'progress__fill' }),
    ),
  );
}

/**
 * @param {object} plant
 * @param {(plant: object) => void} onLogWatering
 * @returns {HTMLElement}
 */
function renderLogAction(plant, onLogWatering) {
  return el(
    'div',
    { className: 'plant-card__action' },
    el(
      'button',
      {
        className: 'btn btn--ghost plant-card__log',
        type: 'button',
        'aria-label': `Log watering for ${plant.name}`,
        onClick: () => onLogWatering(plant),
      },
      svgIcon('drop', { size: 18 }),
      'Log watering',
    ),
  );
}

/** @param {object} schedule @returns {HTMLElement} */
function renderBadge(schedule) {
  const { daysUntil, neverWatered } = schedule;
  const short = neverWatered
    ? 'Water now'
    : daysUntil < 0
      ? `${Math.abs(daysUntil)}d over`
      : daysUntil === 0
        ? 'Due today'
        : `In ${daysUntil}d`;
  return el('span', { className: `plant-card__badge plant-card__badge--${wateringState(schedule)}` }, short);
}

/**
 * Urgency band. Paired with the due text everywhere it is used, so colour is
 * never the only signal (WCAG 2.1 AA).
 * @param {{daysUntil: number}} schedule
 * @returns {'overdue'|'due'|'ok'}
 */
function wateringState({ daysUntil }) {
  if (daysUntil < 0) {
    return 'overdue';
  }
  return daysUntil === 0 ? 'due' : 'ok';
}

/** @param {object} schedule @returns {string} */
function dueText({ daysUntil, neverWatered }) {
  if (neverWatered) {
    return 'Not watered yet';
  }
  if (daysUntil < 0) {
    return `${plural(Math.abs(daysUntil), 'day')} overdue`;
  }
  return daysUntil === 0 ? 'Water today' : `In ${plural(daysUntil, 'day')}`;
}

/** @param {number} count @param {string} word @returns {string} */
function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
