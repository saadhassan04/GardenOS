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
  getLineage,
  setPlantStatus,
  deletePlantPermanently,
} from '../services/plantService.js';
import { logEvent, getTimeline, undoBatch } from '../services/careEventService.js';
import { eventFormDialog } from '../components/EventFormDialog.js';
import { feedFlow } from '../components/FertilizeDialog.js';
import { harvestFlow } from '../components/HarvestDialog.js';
import { lastFeeding, describeFeeding } from '../services/fertilizerService.js';
import { renderPestSection } from '../components/PlantPestSection.js';
import { getLocation } from '../services/locationsService.js';
import { getCareProfile } from '../services/careProfileService.js';
import { pickFile } from '../components/fileTransfer.js';
import { photoTile } from './GalleryPage.js';
import { ingestImage, getGrowthSeries, thumbnailUrl } from '../services/imageService.js';
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
        { className: 'detail-hero' },
        coverThumb(plant),
        el(
          'div',
          {},
          el('h1', {}, plant.name),
          plant.botanicalName ? el('p', { className: 'text-small text-muted' }, plant.botanicalName) : null,
          el(
            'div',
            { className: 'plant-card__meta' },
            plant.category ? el('span', { className: 'chip' }, PLANT_CATEGORIES[plant.category]?.label ?? plant.category) : null,
            plant.status !== 'active' ? el('span', { className: 'chip chip--medium' }, PLANT_STATUSES[plant.status]?.label ?? plant.status) : null,
          ),
        ),
      ),
      el('a', { className: 'btn', href: `#/plants/${plant.id}/edit` }, 'Edit'),
    ),
  );

  // Harvest suits edible categories, plus any plant that has been harvested before.
  const canHarvest = ['vegetable', 'herb', 'tree'].includes(plant.category)
    || (await getTimeline(plant.id, { types: ['harvest'], limit: 1 })).items.length > 0;
  page.append(quickLogSection(plant, refresh, canHarvest));
  page.append(await photosSection(plant, refresh));
  page.append(await profileSection(plant));
  page.append(await renderPestSection(plant, refresh));
  page.append(await lineageSection(plant));
  page.append(await timelineSection(plant));
  page.append(managementSection(plant, refresh));
}

/** Cover photo (or leaf placeholder) beside the plant name. */
function coverThumb(plant) {
  const thumb = el('div', { className: 'plant-card__thumb detail-hero__thumb' }, svgIcon('leaf', { size: 28 }));
  if (plant.coverImageId) {
    thumbnailUrl(plant.coverImageId).then((url) => {
      if (url) {
        thumb.replaceChildren(el('img', { className: 'plant-card__cover', src: url, alt: '' }));
      }
    });
  }
  return thumb;
}

function quickLogSection(plant, refresh, canHarvest) {
  const buttons = Object.entries(EVENT_TYPES)
    .filter(([, spec]) => spec.quickLog)
    .map(([type, spec]) =>
      el(
        'button',
        {
          className: 'btn quick-log__btn',
          onClick: async () => {
            if (type === 'fertilizing') {
              if (await feedFlow([plant.id], plant.name)) {
                refresh();
              }
              return;
            }
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

  const moreButton = el(
    'button',
    {
      className: 'btn btn--ghost quick-log__btn',
      onClick: async () => {
        // Defaults to a dated observation note — the everyday "log an update"
        // path — but any event type (incl. flowering/fruiting milestones) is
        // selectable in the dialog.
        const entry = await eventFormDialog({
          title: `Add update for ${plant.name}`,
          defaultType: 'observation',
        });
        if (!entry) {
          return;
        }
        try {
          const { batchId } = await logEvent(plant.id, entry.type, {
            occurredAt: entry.occurredAt,
            data: entry.data,
          });
          showToast(`${EVENT_TYPES[entry.type].label} logged`, {
            actionLabel: 'Undo',
            onAction: async () => {
              await undoBatch(batchId);
              showToast('Undone');
              refresh();
            },
          });
          refresh();
        } catch (error) {
          logger.error('Event log failed', { error: error.message });
          showToast(`Could not log: ${error.message}`);
        }
      },
    },
    svgIcon('note', { size: 20 }),
    'Add note / update…',
  );

  return el(
    'section',
    { className: 'page-section' },
    el('span', { className: 'text-caption' }, 'Quick log & progress'),
    el(
      'div',
      { className: 'card quick-log' },
      ...buttons,
      canHarvest
        ? el('button', { className: 'btn quick-log__btn', onClick: async () => { if (await harvestFlow({ crop: plant.name, plantId: plant.id })) { refresh(); } } }, svgIcon('basket', { size: 20 }), 'Harvest')
        : null,
      moreButton,
    ),
  );
}

/**
 * Growth photo strip (FR-6.4): the plant's newest photos, horizontally
 * scrollable, plus camera capture. Chronology reads right-to-left here;
 * the full story lives in the viewer and gallery.
 */
async function photosSection(plant, refresh) {
  const { items } = await getGrowthSeries(plant.id, { limit: 12 });

  const strip = el('div', { className: 'photo-strip' });
  for (const record of items) {
    strip.append(await photoTile(record, refresh));
  }
  if (items.length === 0) {
    strip.append(
      el('p', { className: 'text-small text-muted' }, 'No photos yet — capture the first chapter.'),
    );
  }

  const addButton = el(
    'button',
    {
      className: 'btn',
      onClick: async () => {
        const file = await pickFile('image/*', { capture: 'environment' });
        if (!file) {
          return;
        }
        try {
          await ingestImage(file, { plantId: plant.id });
          showToast(`Photo added to ${plant.name}`);
          refresh();
        } catch (error) {
          logger.error('Photo ingest failed', { error: error.message });
          showToast(error.message);
        }
      },
    },
    svgIcon('camera', { size: 20 }),
    'Add photo',
  );

  return el(
    'section',
    { className: 'page-section' },
    el('span', { className: 'text-caption' }, `Photos (${plant.derived.imageCount})`),
    el('div', { className: 'card stack' }, strip, el('div', { className: 'dialog__actions' }, addButton)),
  );
}

/** Propagation lineage (FR-1.6): shown only when a relationship exists. */
async function lineageSection(plant) {
  const { ancestors, children } = await getLineage(plant.id);
  if (ancestors.length === 0 && children.length === 0) {
    return el('span', { className: 'visually-hidden' });
  }

  const rows = [];
  if (ancestors.length > 0) {
    rows.push(
      el(
        'div',
        { className: 'status-row' },
        el('span', {}, 'Grown from'),
        el('span', { className: 'status-row__value' }, el('a', { href: `#/plants/${ancestors[0].id}` }, ancestors[0].name)),
      ),
    );
  }
  for (const child of children) {
    rows.push(
      el(
        'div',
        { className: 'status-row' },
        el('span', {}, 'Propagated into'),
        el('span', { className: 'status-row__value' }, el('a', { href: `#/plants/${child.id}` }, child.name)),
      ),
    );
  }

  return el(
    'section',
    { className: 'page-section' },
    el('span', { className: 'text-caption' }, 'Propagation'),
    el('div', { className: 'card' }, ...rows),
  );
}

async function profileSection(plant) {
  const location = plant.locationId ? await getLocation(plant.locationId) : null;
  const careProfile = plant.careProfileId ? await getCareProfile(plant.careProfileId) : null;
  const lastFed = await lastFeeding(plant.id);

  const rows = [
    ['Category', plant.category ? PLANT_CATEGORIES[plant.category]?.label : '—'],
    ['Status', PLANT_STATUSES[plant.status]?.label ?? plant.status],
    ['Location', location?.name ?? '—'],
    ['Care profile', careProfile?.name ?? '—'],
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
    ['Last fed', lastFed ? `${lastFed.product}, ${relativeDate(plant.derived.lastFertilizedAt)}` : relativeDate(plant.derived.lastFertilizedAt)],
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
      el('span', {}, event.type === 'fertilizing' && event.data?.product ? `${spec.label} — ${describeFeeding(event.data)}` : spec.label),
      el('p', { className: 'text-small text-muted' }, `${relativeDate(event.occurredAt)} · ${formatDate(event.occurredAt)}`),
      event.data?.note ? el('p', { className: 'text-small' }, event.data.note) : null,
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
