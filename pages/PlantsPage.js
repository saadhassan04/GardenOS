/**
 * Plants page (UI layer, L5) — FR-1.4, T-033.
 * Searchable, filterable, sortable list of the whole collection.
 */

import { el, svgIcon, clear } from '../utils/dom.js';
import { listPlants } from '../services/plantService.js';
import { renderPlantCard } from '../components/PlantCard.js';
import { logger } from '../utils/logger.js';
import { PLANT_CATEGORIES, PLANT_STATUSES } from '../config/registries.js';

/** @returns {HTMLElement} */
export function renderPlantsPage() {
  const page = el('div', {});
  const state = { status: 'active', category: '', search: '', sort: 'name' };

  page.append(
    el(
      'header',
      { className: 'page-header page-header--split' },
      el('h1', {}, 'Plants'),
      el(
        'a',
        { className: 'btn btn--primary', href: '#/plants/new' },
        svgIcon('plus', { size: 20 }),
        'Add plant',
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

  const sortSelect = filterSelect('Sort', [['name', 'By name'], ['newest', 'Newest first']], (value) => {
    state.sort = value;
    refresh();
  });

  page.append(el('div', { className: 'filter-bar' }, searchInput, categorySelect, statusSelect, sortSelect));

  const listRegion = el('div', { className: 'plant-grid' });
  page.append(listRegion);

  async function refresh() {
    try {
      const plants = await listPlants({
        status: state.status,
        category: state.category || null,
        search: state.search,
        sort: state.sort,
      });
      clear(listRegion);
      if (plants.length === 0) {
        listRegion.append(
          el(
            'div',
            { className: 'card empty-state' },
            el('p', {}, state.search || state.category ? 'No plants match those filters.' : 'No plants yet.'),
            state.search || state.category
              ? null
              : el('a', { className: 'btn btn--primary', href: '#/plants/new' }, 'Add your first plant'),
          ),
        );
        return;
      }
      listRegion.append(...plants.map(renderPlantCard));
    } catch (error) {
      logger.error('Plant list failed to load', { error: error.message });
      clear(listRegion);
      listRegion.append(el('div', { className: 'card' }, `Could not load plants: ${error.message}`));
    }
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
