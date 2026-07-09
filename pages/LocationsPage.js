/**
 * Locations page (UI layer, L5) — T-039.
 * Manage garden areas; shows resident plant counts. Reached from Settings.
 */

import { el, svgIcon, clear } from '../utils/dom.js';
import { showToast } from '../components/Toast.js';
import { formDialog } from '../components/FormDialog.js';
import { confirmDialog } from '../components/ConfirmDialog.js';
import { LOCATION_KINDS, SUN_PROFILES } from '../models/Location.js';
import {
  createLocation,
  updateLocation,
  deleteLocation,
  listLocations,
  countPlantsAt,
} from '../services/locationsService.js';
import { logger } from '../utils/logger.js';

/** @returns {HTMLElement} */
export function renderLocationsPage() {
  const page = el('div', {});

  const addButton = el(
    'button',
    { className: 'btn btn--primary', onClick: () => openForm(null) },
    svgIcon('plus', { size: 20 }),
    'Add location',
  );

  page.append(
    el('header', { className: 'page-header page-header--split' }, el('h1', {}, 'Locations'), addButton),
    el(
      'p',
      { className: 'text-small text-muted page-section' },
      'The areas of your garden — balconies, rooftop, beds, rooms. Plants are assigned a location on their edit form.',
    ),
  );

  const listRegion = el('div', { className: 'stack' });
  page.append(listRegion);

  async function refresh() {
    try {
      const locations = await listLocations();
      clear(listRegion);
      if (locations.length === 0) {
        listRegion.append(
          el('div', { className: 'card empty-state' }, el('p', {}, 'No locations yet — add your first garden area.')),
        );
        return;
      }
      for (const location of locations) {
        listRegion.append(await locationCard(location));
      }
    } catch (error) {
      logger.error('Locations failed to load', { error: error.message });
      clear(listRegion);
      listRegion.append(el('div', { className: 'card' }, `Could not load locations: ${error.message}`));
    }
  }

  async function locationCard(location) {
    const residents = await countPlantsAt(location.id);
    return el(
      'div',
      { className: 'card note-card__head' },
      el(
        'div',
        {},
        el('h3', { className: 'plant-card__name' }, location.name),
        el(
          'div',
          { className: 'plant-card__meta' },
          el('span', { className: 'chip' }, LOCATION_KINDS[location.kind]?.label ?? location.kind),
          location.sunProfile ? el('span', { className: 'chip' }, SUN_PROFILES[location.sunProfile]?.label) : null,
          el('span', { className: 'text-small text-muted' }, `${residents} plant(s)`),
        ),
      ),
      el(
        'div',
        { className: 'dialog__actions' },
        el('button', { className: 'btn', onClick: () => openForm(location) }, 'Edit'),
        el(
          'button',
          {
            className: 'btn btn--ghost',
            onClick: async () => {
              const ok = await confirmDialog({
                title: `Delete ${location.name}?`,
                body: residents > 0
                  ? `${residents} plant(s) live here — deletion will be refused until they move.`
                  : 'This location has no plants assigned.',
                confirmLabel: 'Delete',
                danger: true,
              });
              if (!ok) {
                return;
              }
              try {
                await deleteLocation(location.id);
                showToast(`${location.name} deleted`);
                refresh();
              } catch (error) {
                showToast(error.message);
              }
            },
          },
          'Delete',
        ),
      ),
    );
  }

  async function openForm(location) {
    const values = await formDialog({
      title: location ? `Edit ${location.name}` : 'Add location',
      submitLabel: location ? 'Save changes' : 'Add location',
      fields: [
        { name: 'name', label: 'Name', required: true, value: location?.name ?? '', placeholder: 'East Balcony' },
        {
          name: 'kind',
          label: 'Kind',
          kind: 'select',
          value: location?.kind ?? 'balcony',
          options: Object.entries(LOCATION_KINDS).map(([key, spec]) => [key, spec.label]),
        },
        {
          name: 'sunProfile',
          label: 'Sun',
          kind: 'select',
          value: location?.sunProfile ?? '',
          options: [['', 'Not set'], ...Object.entries(SUN_PROFILES).map(([key, spec]) => [key, spec.label])],
        },
        { name: 'notes', label: 'Notes', kind: 'textarea', value: location?.notes ?? '' },
      ],
    });
    if (!values) {
      return;
    }
    try {
      const input = { ...values, sunProfile: values.sunProfile || null };
      if (location) {
        await updateLocation(location.id, input);
        showToast('Location updated');
      } else {
        await createLocation(input);
        showToast(`${input.name} added`);
      }
      refresh();
    } catch (error) {
      showToast(error.message);
    }
  }

  refresh();
  return page;
}
