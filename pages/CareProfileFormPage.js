/**
 * Care profile create/edit form (UI layer, L5) — FR-1.3.
 * Name-only minimum; seasonal watering (summer/monsoon/winter), fertilizing,
 * repotting, and seasonal notes are all optional. Seeded presets are
 * editable (they become source 'user' implicitly is avoided — the service
 * preserves source), and deletable only when unused.
 */

import { el } from '../utils/dom.js';
import { navigate } from '../hooks/router.js';
import { showToast } from '../components/Toast.js';
import { confirmDialog } from '../components/ConfirmDialog.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  getCareProfile,
  createCareProfile,
  updateCareProfile,
  deleteCareProfile,
  countPlantsUsingProfile,
} from '../services/careProfileService.js';

/**
 * @param {{params: {id?: string}}} context edit mode when params.id is set
 * @returns {Promise<HTMLElement>}
 */
export async function renderCareProfileFormPage({ params }) {
  const editing = Boolean(params.id);
  const profile = editing ? await getCareProfile(params.id) : null;
  if (editing && !profile) {
    return el('div', { className: 'card' }, 'That profile no longer exists. ', el('a', { href: '#/care-profiles' }, 'Back to care profiles'));
  }

  const page = el('div', {});
  page.append(el('header', { className: 'page-header' }, el('h1', {}, editing ? `Edit ${profile.name}` : 'New care profile')));

  const seasonal = profile?.wateringSeasonal ?? {};
  const fields = {
    name: textField('Name', profile?.name ?? '', { required: true, placeholder: 'e.g. My Balcony Roses' }),
    species: textField('Species', profile?.species ?? '', { placeholder: 'Rosa' }),
    summer: numberField('Water every N days — summer', seasonal.summer),
    monsoon: numberField('Water every N days — monsoon', seasonal.monsoon),
    winter: numberField('Water every N days — winter', seasonal.winter),
    wateringEveryDays: numberField('Water every N days — all year (used if seasonal blank)', profile?.wateringEveryDays),
    fertilizeEveryDays: numberField('Fertilize every N days', profile?.fertilizeEveryDays),
    fertilizer: textField('Fertilizer', profile?.fertilizer ?? '', { placeholder: 'Balanced NPK…' }),
    repotEveryMonths: numberField('Repot every N months', profile?.repotEveryMonths),
    pruningNotes: textAreaField('Pruning notes', profile?.pruningNotes ?? ''),
    heatWave: textAreaField('Heat-wave note', profile?.seasonalNotes?.heatWave ?? ''),
    monsoonNote: textAreaField('Monsoon note', profile?.seasonalNotes?.monsoon ?? ''),
  };

  const form = el(
    'form',
    {
      className: 'card stack',
      onSubmit: async (event) => {
        event.preventDefault();
        const input = collect(fields);
        try {
          const saved = editing
            ? await updateCareProfile(profile.id, input)
            : await createCareProfile(input);
          showToast(editing ? `${saved.name} updated` : `${saved.name} created`);
          navigate('/care-profiles');
        } catch (error) {
          if (error instanceof ValidationError) {
            showToast(error.message);
            fields.name.control.focus();
          } else {
            logger.error('Care profile save failed', { error: error.message });
            showToast(`Could not save: ${error.message}`);
          }
        }
      },
    },
    el('span', { className: 'text-caption' }, 'Watering leaves blank as "not set" — GardenOS never guesses an interval.'),
    ...Object.values(fields).map((field) => field.root),
    el(
      'div',
      { className: 'dialog__actions' },
      editing ? deleteButton(profile) : null,
      el('a', { className: 'btn', href: '#/care-profiles' }, 'Cancel'),
      el('button', { className: 'btn btn--primary', type: 'submit' }, editing ? 'Save changes' : 'Create profile'),
    ),
  );

  page.append(form);
  return page;
}

function collect(fields) {
  const num = (field) => {
    const raw = field.control.value.trim();
    return raw === '' ? null : Number(raw);
  };
  const summer = num(fields.summer);
  const monsoon = num(fields.monsoon);
  const winter = num(fields.winter);
  const anySeasonal = summer !== null || monsoon !== null || winter !== null;

  return {
    name: fields.name.control.value,
    species: fields.species.control.value,
    wateringSeasonal: anySeasonal ? { summer, monsoon, winter } : null,
    wateringEveryDays: num(fields.wateringEveryDays),
    fertilizeEveryDays: num(fields.fertilizeEveryDays),
    fertilizer: fields.fertilizer.control.value,
    repotEveryMonths: num(fields.repotEveryMonths),
    pruningNotes: fields.pruningNotes.control.value,
    seasonalNotes: {
      heatWave: fields.heatWave.control.value,
      monsoon: fields.monsoonNote.control.value,
    },
  };
}

function deleteButton(profile) {
  return el(
    'button',
    {
      className: 'btn btn--danger',
      type: 'button',
      onClick: async () => {
        const inUse = await countPlantsUsingProfile(profile.id);
        if (inUse > 0) {
          showToast(`${inUse} plant(s) use this profile — reassign them first`);
          return;
        }
        const ok = await confirmDialog({
          title: `Delete ${profile.name}?`,
          body: 'The profile is removed. Karachi presets reappear only on a fresh install.',
          confirmLabel: 'Delete profile',
          danger: true,
        });
        if (!ok) {
          return;
        }
        try {
          await deleteCareProfile(profile.id);
          showToast('Care profile deleted');
          navigate('/care-profiles');
        } catch (error) {
          showToast(error.message);
        }
      },
    },
    'Delete',
  );
}

/* ---- field helpers ---- */

function wrap(label, control, hint = null) {
  const id = `cp-${label.replace(/\W+/g, '-').toLowerCase()}`;
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

function textField(label, value, { required = false, placeholder = '' } = {}) {
  const control = el('input', { className: 'field__control', type: 'text', value, placeholder });
  if (required) {
    control.setAttribute('required', '');
  }
  return wrap(label, control);
}

function textAreaField(label, value) {
  const control = el('textarea', { className: 'field__control field__control--area', rows: '2' }, value);
  return wrap(label, control);
}

function numberField(label, value) {
  const control = el('input', {
    className: 'field__control',
    type: 'number',
    min: '1',
    step: '1',
    inputmode: 'numeric',
    value: value === null || value === undefined ? '' : String(value),
  });
  return wrap(label, control);
}
