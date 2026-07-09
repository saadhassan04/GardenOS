/**
 * Plant create/edit form (UI layer, L5) — FR-1.2, US-A1, T-034.
 * Only the name is required; everything else is optional and editable
 * later. Labels always visible; validation errors surface inline via toast
 * + field focus (UI_GUIDELINES.md §7 Forms).
 */

import { el } from '../utils/dom.js';
import { navigate } from '../hooks/router.js';
import { showToast } from '../components/Toast.js';
import { createPlant, updatePlant, getPlant, listPlants } from '../services/plantService.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  PLANT_CATEGORIES,
  PLANT_STATUSES,
  SUN_EXPOSURES,
  CONTAINER_TYPES,
} from '../config/registries.js';

/**
 * @param {{params: {id?: string}}} context edit mode when params.id is set
 * @returns {Promise<HTMLElement>}
 */
export async function renderPlantFormPage({ params }) {
  const editing = Boolean(params.id);
  const plant = editing ? await getPlant(params.id) : null;
  if (editing && !plant) {
    return el('div', { className: 'card' }, 'That plant no longer exists. ', el('a', { href: '#/plants' }, 'Back to plants'));
  }

  const page = el('div', {});
  page.append(
    el('header', { className: 'page-header' }, el('h1', {}, editing ? `Edit ${plant.name}` : 'Add plant')),
  );

  // Parent picker (FR-1.6): any other plant can be the propagation source.
  const candidates = (await listPlants({ status: 'active' }))
    .concat(await listPlants({ status: 'archived' }))
    .filter((candidate) => candidate.id !== plant?.id);

  const fields = {
    name: textField('Name', plant?.name ?? '', { required: true }),
    botanicalName: textField('Botanical name', plant?.botanicalName ?? ''),
    category: selectField('Category', optionList(PLANT_CATEGORIES, 'No category'), plant?.category ?? ''),
    parentPlantId: selectField(
      'Grown from (propagation parent)',
      [['', 'Not a propagation'], ...candidates.map((c) => [c.id, c.name])],
      plant?.parentPlantId ?? '',
    ),
    status: editing
      ? selectField('Status', Object.entries(PLANT_STATUSES).map(([k, s]) => [k, s.label]), plant.status)
      : null,
    acquiredAt: dateField('Acquired on', plant?.acquiredAt ?? ''),
    sunExposure: selectField('Sun exposure', optionList(SUN_EXPOSURES, 'Not set'), plant?.location?.sunExposure ?? ''),
    containerType: selectField('Container', optionList(CONTAINER_TYPES, 'None / not set'), plant?.container?.type ?? ''),
    containerSize: numberField('Container size (inches)', plant?.container?.sizeInches ?? ''),
    soilMix: textField('Soil mix', plant?.soilMix ?? ''),
    notes: textAreaField('Notes', plant?.notes ?? ''),
  };

  const form = el(
    'form',
    {
      className: 'card stack',
      onSubmit: async (event) => {
        event.preventDefault();
        const input = collect(fields, plant);
        try {
          const saved = editing ? await updatePlant(plant.id, input) : await createPlant(input);
          showToast(editing ? `${saved.name} updated` : `${saved.name} added to the garden`);
          navigate(`/plants/${saved.id}`);
        } catch (error) {
          if (error instanceof ValidationError) {
            showToast(error.message);
            fields.name.control.focus();
          } else {
            logger.error('Plant save failed', { error: error.message });
            showToast(`Could not save: ${error.message}`);
          }
        }
      },
    },
    ...Object.values(fields).filter(Boolean).map((field) => field.root),
    el(
      'div',
      { className: 'dialog__actions' },
      el('a', { className: 'btn', href: editing ? `#/plants/${plant.id}` : '#/plants' }, 'Cancel'),
      el('button', { className: 'btn btn--primary', type: 'submit' }, editing ? 'Save changes' : 'Add plant'),
    ),
  );

  page.append(form);
  return page;
}

function collect(fields, existing) {
  const containerType = fields.containerType.control.value;
  const sizeRaw = fields.containerSize.control.value;
  return {
    name: fields.name.control.value,
    botanicalName: fields.botanicalName.control.value,
    category: fields.category.control.value || null,
    parentPlantId: fields.parentPlantId.control.value || null,
    status: fields.status ? fields.status.control.value : 'active',
    acquiredAt: fields.acquiredAt.control.value || null,
    location: {
      ...(existing?.location ?? {}),
      sunExposure: fields.sunExposure.control.value || null,
    },
    container: containerType
      ? { type: containerType, sizeInches: sizeRaw ? Number(sizeRaw) : null, drainage: true }
      : null,
    soilMix: fields.soilMix.control.value,
    notes: fields.notes.control.value,
  };
}

function optionList(registry, emptyLabel) {
  return [['', emptyLabel], ...Object.entries(registry).map(([key, spec]) => [key, spec.label])];
}

function wrap(label, control, hint = null) {
  const id = `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  control.setAttribute('id', id);
  const root = el(
    'div',
    { className: 'field' },
    el('label', { className: 'field__label', for: id }, label),
    control,
    hint ? el('span', { className: 'field__hint' }, hint) : null,
  );
  return { root, control };
}

function textField(label, value, { required = false } = {}) {
  const control = el('input', { className: 'field__control', type: 'text', value });
  if (required) {
    control.setAttribute('required', '');
  }
  return wrap(label, control);
}

function textAreaField(label, value) {
  const control = el('textarea', { className: 'field__control field__control--area', rows: '3' }, value);
  return wrap(label, control);
}

function dateField(label, value) {
  const control = el('input', { className: 'field__control', type: 'date', value: value ? value.slice(0, 10) : '' });
  return wrap(label, control);
}

function numberField(label, value) {
  const control = el('input', {
    className: 'field__control',
    type: 'number',
    min: '1',
    step: '0.5',
    value: value === null || value === '' ? '' : String(value),
  });
  return wrap(label, control);
}

function selectField(label, options, selected) {
  const control = el(
    'select',
    { className: 'field__control' },
    ...options.map(([value, text]) => el('option', { value }, text)),
  );
  control.value = selected ?? '';
  return wrap(label, control);
}
