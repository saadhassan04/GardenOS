/**
 * Plant detail page (UI layer, L5) — FR-2, US-A3, T-035.
 * Profile summary, one-tap quick logging with Undo, and the paginated,
 * filterable event timeline (newest first, backdate-friendly).
 */

import { el, svgIcon, clear } from '../utils/dom.js';
import { navigate } from '../hooks/router.js';
import { showToast } from '../components/Toast.js';
import { confirmDialog } from '../components/ConfirmDialog.js';
import { relativeDate, formatDate } from '../utils/dates.js';
import { logger } from '../utils/logger.js';
import {
  getPlant,
  setPlantStatus,
  deletePlantPermanently,
} from '../services/plantService.js';
import { logEvent, getTimeline, undoBatch } from '../services/careEventService.js';
import {
  PLANT_CATEGORIES,
  PLANT_STATUSES,
  SUN_EXPOSURES,
  CONTAINER_TYPES,
  EVENT_TYPES,
} from '../config/registries.js';

/**
 * @param {{params: {id: string}}} context
 * @returns {Promise<HTMLElement>}
 */
export async function renderPlantDetailPage({ params }) {
  const page = el('div', {});
  await build(page, params.id);
  return page;
}

async function build(page, plantId) {
  clear(page);
  const plant = await getPlant(plantId);
  if (!plant) {
    page.append(
      el('div', { className: 'card' }, 'That plant no longer exists. ', el('a', { href: '#/plants' }, 'Back to plants')),
    );
    return;
  }
  const refresh = () => build(page, plantId);

  page.append(
    el(
      'header',
      { className: 'page-header page-header--split' },
      el(
        'div',
        {},
        el('h1', {}, plant.name),
        plant.botanicalName ? el('p', { className: 'text-small text-muted' }, plant.botanicalName) : null,
      ),
      el('a', { className: 'btn', href: `#/plants/${plant.id}/edit` }, 'Edit'),
    ),
  );

  page.append(quickLogSection(plant, refresh));
  page.append(profileSection(plant));
  page.append(await timelineSection(plant));
  page.append(managementSection(plant, refresh));
}

function quickLogSection(plant, refresh) {
  const buttons = Object.entries(EVENT_TYPES)
    .filter(([, spec]) => spec.quickLog)
    .map(([type, spec]) =>
      el(
        'button',
        {
          className: 'btn quick-log__btn',
          onClick: async () => {
            try {
              const { batchId } = await logEvent(plant.id, type);
              showToast(`${spec.label} logged for ${plant.name}`, {
                actionLabel: 'Undo',
                onAction: async () => {
                  await undoBatch(batchId);
                  showToast('Undone');
                  refresh();
                },
              });
              refresh();
            } catch (error) {
              logger.error('Quick log failed', { error: error.message });
              showToast(`Could not log: ${error.message}`);
            }
          },
        },
        svgIcon(spec.icon, { size: 20 }),
        spec.label,
      ),
    );

  return el(
    'section',
    { className: 'page-section' },
    el('span', { className: 'text-caption' }, 'Quick log'),
    el('div', { className: 'card quick-log' }, ...buttons),
  );
}

function profileSection(plant) {
  const rows = [
    ['Category', plant.category ? PLANT_CATEGORIES[plant.category]?.label : '—'],
    ['Status', PLANT_STATUSES[plant.status]?.label ?? plant.status],
    ['Acquired', plant.acquiredAt ? formatDate(plant.acquiredAt) : '—'],
    ['Sun exposure', plant.location.sunExposure ? SUN_EXPOSURES[plant.location.sunExposure]?.label : '—'],
    [
      'Container',
      plant.container
        ? `${CONTAINER_TYPES[plant.container.type]?.label ?? plant.container.type}${plant.container.sizeInches ? `, ${plant.container.sizeInches}"` : ''}`
        : '—',
    ],
    ['Soil mix', plant.soilMix || '—'],
    ['Last watered', relativeDate(plant.derived.lastWateredAt)],
    ['Last fertilized', relativeDate(plant.derived.lastFertilizedAt)],
    ['Last repotted', relativeDate(plant.derived.lastRepottedAt)],
    ['Events recorded', String(plant.derived.eventCount)],
  ];

  return el(
    'section',
    { className: 'page-section' },
    el('span', { className: 'text-caption' }, 'Profile & care'),
    el(
      'div',
      { className: 'card' },
      ...rows.map(([label, value]) =>
        el(
          'div',
          { className: 'status-row' },
          el('span', {}, label),
          el('span', { className: 'status-row__value' }, value),
        ),
      ),
      plant.notes ? el('p', { className: 'text-small text-muted' }, plant.notes) : null,
    ),
  );
}

async function timelineSection(plant) {
  const listEl = el('div', { className: 'timeline' });
  const state = { cursor: null, types: null };

  const loadMoreBtn = el('button', { className: 'btn', onClick: () => load() }, 'Load more');
  const footer = el('div', { className: 'dialog__actions' }, loadMoreBtn);

  const typeFilter = el(
    'select',
    {
      className: 'field__control filter-bar__select',
      'aria-label': 'Filter timeline by event type',
      onChange: (event) => {
        state.types = event.target.value ? [event.target.value] : null;
        state.cursor = null;
        clear(listEl);
        load();
      },
    },
    el('option', { value: '' }, 'All events'),
    ...Object.entries(EVENT_TYPES).map(([key, spec]) => el('option', { value: key }, spec.label)),
  );

  async function load() {
    try {
      const { items, nextCursor } = await getTimeline(plant.id, {
        types: state.types,
        cursor: state.cursor,
        limit: 20,
      });
      if (items.length === 0 && listEl.children.length === 0) {
        listEl.append(
          el('p', { className: 'text-muted text-small' }, 'Nothing logged yet — the story starts with the first quick log above.'),
        );
      }
      listEl.append(...items.map(timelineItem));
      state.cursor = nextCursor;
      footer.style.display = nextCursor ? '' : 'none';
    } catch (error) {
      logger.error('Timeline failed to load', { error: error.message });
      listEl.append(el('p', { className: 'text-small' }, `Could not load timeline: ${error.message}`));
    }
  }
  await load();

  return el(
    'section',
    { className: 'page-section' },
    el('span', { className: 'text-caption' }, 'Timeline'),
    el('div', { className: 'card stack' }, typeFilter, listEl, footer),
  );
}

function timelineItem(event) {
  const spec = EVENT_TYPES[event.type] ?? { label: event.type, icon: 'note' };
  return el(
    'div',
    { className: 'timeline__item' },
    svgIcon(spec.icon, { size: 20, className: 'timeline__icon' }),
    el(
      'div',
      {},
      el('span', {}, spec.label),
      el('p', { className: 'text-small text-muted' }, `${relativeDate(event.occurredAt)} · ${formatDate(event.occurredAt)}`),
    ),
  );
}

function managementSection(plant, refresh) {
  const archived = plant.status === 'archived';
  const archiveBtn = el(
    'button',
    {
      className: 'btn',
      onClick: async () => {
        await setPlantStatus(plant.id, archived ? 'active' : 'archived');
        showToast(archived ? `${plant.name} is active again` : `${plant.name} archived — history kept`);
        refresh();
      },
    },
    archived ? 'Unarchive' : 'Archive',
  );

  const deleteBtn = el(
    'button',
    {
      className: 'btn btn--danger',
      onClick: async () => {
        const ok = await confirmDialog({
          title: `Delete ${plant.name} permanently?`,
          body: `This erases the plant and all ${plant.derived.eventCount} logged events forever. Archiving keeps the history instead.`,
          confirmLabel: 'Delete forever',
          danger: true,
        });
        if (!ok) {
          return;
        }
        try {
          const { deletedEvents } = await deletePlantPermanently(plant.id);
          showToast(`${plant.name} and ${deletedEvents} events deleted`);
          navigate('/plants');
        } catch (error) {
          logger.error('Permanent delete failed', { error: error.message });
          showToast(`Could not delete: ${error.message}`);
        }
      },
    },
    'Delete permanently',
  );

  return el(
    'section',
    { className: 'page-section' },
    el('span', { className: 'text-caption' }, 'Manage'),
    el('div', { className: 'card dialog__actions' }, archiveBtn, deleteBtn),
  );
}
