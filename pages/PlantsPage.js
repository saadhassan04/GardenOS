/**
 * Plants page (UI layer, L5) — FR-1.4, T-033.
 * Searchable, filterable, sortable list of the whole collection.
 */

import { el, svgIcon, clear } from '../utils/dom.js';
import { listPlants } from '../services/plantService.js';
import { listLocations } from '../services/locationsService.js';
import { logBulk, undoBatch } from '../services/careEventService.js';
import { renderPlantCard } from '../components/PlantCard.js';
import { showToast } from '../components/Toast.js';
import { eventFormDialog } from '../components/EventFormDialog.js';
import { logger } from '../utils/logger.js';
import { PLANT_CATEGORIES, PLANT_STATUSES, EVENT_TYPES } from '../config/registries.js';

/** @returns {HTMLElement} */
export function renderPlantsPage() {
  const page = el('div', {});
  const state = {
    status: 'active',
    category: '',
    locationId: '',
    search: '',
    sort: 'name',
    selectMode: false,
    selected: new Set(),
  };

  const selectToggle = el(
    'button',
    {
      className: 'btn',
      'aria-pressed': 'false',
      onClick: () => {
        state.selectMode = !state.selectMode;
        state.selected.clear();
        selectToggle.setAttribute('aria-pressed', String(state.selectMode));
        selectToggle.textContent = state.selectMode ? 'Done' : 'Select';
        refresh();
      },
    },
    'Select',
  );

  page.append(
    el(
      'header',
      { className: 'page-header page-header--split' },
      el('h1', {}, 'Plants'),
      el(
        'div',
        { className: 'dialog__actions' },
        selectToggle,
        el(
          'a',
          { className: 'btn btn--primary', href: '#/plants/new' },
          svgIcon('plus', { size: 20 }),
          'Add plant',
        ),
      ),
    ),
  );

  const searchInput = el('input', {
    className: 'field__control',
    type: 'search',
    placeholder: 'Search plants…',
    'aria-label': 'Search plants',
    onInput: (event) => {
      state.search = event.target.value;
      refresh();
    },
  });

  const categorySelect = filterSelect('Category', [['', 'All categories'], ...Object.entries(PLANT_CATEGORIES).map(([key, spec]) => [key, spec.label])], (value) => {
    state.category = value;
    refresh();
  });

  const statusSelect = filterSelect('Status', Object.entries(PLANT_STATUSES).map(([key, spec]) => [key, spec.label]), (value) => {
    state.status = value;
    refresh();
  });

  // Location filter: options arrive async from the locations store.
  const locationSelect = filterSelect('Location', [['', 'All locations']], (value) => {
    state.locationId = value;
    refresh();
  });
  listLocations().then((locations) => {
    for (const location of locations) {
      locationSelect.append(el('option', { value: location.id }, location.name));
    }
  });

  const sortSelect = filterSelect('Sort', [['name', 'By name'], ['newest', 'Newest first']], (value) => {
    state.sort = value;
    refresh();
  });

  page.append(el('div', { className: 'filter-bar' }, searchInput, categorySelect, locationSelect, statusSelect, sortSelect));

  const listRegion = el('div', { className: 'plant-grid' });
  const actionBar = el('div', { className: 'action-bar', hidden: '' });
  page.append(listRegion, actionBar);

  async function refresh() {
    try {
      const plants = await listPlants({
        status: state.status,
        category: state.category || null,
        locationId: state.locationId || null,
        search: state.search,
        sort: state.sort,
      });
      clear(listRegion);
      if (plants.length === 0) {
        const filtered = state.search || state.category || state.locationId;
        listRegion.append(
          el(
            'div',
            { className: 'card empty-state' },
            el('p', {}, filtered ? 'No plants match those filters.' : 'No plants yet.'),
            filtered
              ? null
              : el('a', { className: 'btn btn--primary', href: '#/plants/new' }, 'Add your first plant'),
          ),
        );
        renderActionBar();
        return;
      }
      listRegion.append(
        ...plants.map((plant) =>
          renderPlantCard(plant, {
            selectable: state.selectMode,
            selected: state.selected.has(plant.id),
            onToggle: (id) => {
              if (state.selected.has(id)) {
                state.selected.delete(id);
              } else {
                state.selected.add(id);
              }
              refresh();
            },
          }),
        ),
      );
      renderActionBar();
    } catch (error) {
      logger.error('Plant list failed to load', { error: error.message });
      clear(listRegion);
      listRegion.append(el('div', { className: 'card' }, `Could not load plants: ${error.message}`));
    }
  }

  /** Bulk action bar (US-A2): visible only in select mode with a selection. */
  function renderActionBar() {
    clear(actionBar);
    if (!state.selectMode || state.selected.size === 0) {
      actionBar.setAttribute('hidden', '');
      return;
    }
    actionBar.removeAttribute('hidden');

    const runBulk = async (type, options = {}) => {
      const plantIds = [...state.selected];
      try {
        const { batchId } = await logBulk(plantIds, type, options);
        showToast(`${EVENT_TYPES[type].label} logged for ${plantIds.length} plants`, {
          actionLabel: 'Undo',
          onAction: async () => {
            await undoBatch(batchId);
            showToast('Undone');
            refresh();
          },
        });
        state.selectMode = false;
        state.selected.clear();
        selectToggle.setAttribute('aria-pressed', 'false');
        selectToggle.textContent = 'Select';
        refresh();
      } catch (error) {
        logger.error('Bulk log failed', { error: error.message });
        showToast(`Could not log: ${error.message}`);
      }
    };

    actionBar.append(
      el('span', { className: 'text-small' }, `${state.selected.size} selected`),
      el('button', { className: 'btn', onClick: () => runBulk('watering') }, svgIcon('drop', { size: 20 }), 'Water'),
      el('button', { className: 'btn', onClick: () => runBulk('fertilizing') }, svgIcon('leaf', { size: 20 }), 'Fertilize'),
      el(
        'button',
        {
          className: 'btn btn--ghost',
          onClick: async () => {
            const entry = await eventFormDialog({ title: `Log for ${state.selected.size} plants` });
            if (entry) {
              runBulk(entry.type, { occurredAt: entry.occurredAt, data: entry.data });
            }
          },
        },
        'More…',
      ),
    );
  }

  refresh();
  return page;
}

function filterSelect(label, options, onChange) {
  return el(
    'select',
    {
      className: 'field__control filter-bar__select',
      'aria-label': label,
      onChange: (event) => onChange(event.target.value),
    },
    ...options.map(([value, text]) => el('option', { value }, text)),
  );
}
