/**
 * Pest & treatments section for the plant detail page (UI layer, L5) —
 * FR-10, T-038. Report → treat (with "what worked last time" hints) →
 * record outcome → resolve, all against one plant.
 */

import { el } from '../utils/dom.js';
import { showToast } from './Toast.js';
import { formDialog } from './FormDialog.js';
import { relativeDate, localDateString } from '../utils/dates.js';
import { logger } from '../utils/logger.js';
import { COMMON_PESTS, PEST_SEVERITIES } from '../models/PestRecord.js';
import { TREATMENT_TYPES, TREATMENT_OUTCOMES } from '../models/Treatment.js';
import {
  observePest,
  resolvePest,
  listActivePestsForPlant,
} from '../services/pestService.js';
import {
  applyTreatment,
  recordOutcome,
  listTreatmentsForPest,
  whatWorkedFor,
} from '../services/treatmentService.js';

/**
 * @param {object} plant
 * @param {() => void} refresh re-render the host page
 * @returns {Promise<HTMLElement>}
 */
export async function renderPestSection(plant, refresh) {
  const card = el('div', { className: 'card stack' });

  const active = await listActivePestsForPlant(plant.id);
  if (active.length === 0) {
    card.append(el('p', { className: 'text-small text-muted' }, 'No active pest or disease problems. Long may it last.'));
  }
  for (const record of active) {
    card.append(await pestRow(record, plant, refresh));
  }

  card.append(
    el(
      'div',
      { className: 'dialog__actions' },
      el('button', { className: 'btn', onClick: () => reportFlow(plant, refresh) }, 'Report pest…'),
    ),
  );

  return el(
    'section',
    { className: 'page-section' },
    el('span', { className: 'text-caption' }, 'Pests & treatments'),
    card,
  );
}

async function pestRow(record, plant, refresh) {
  const treatments = await listTreatmentsForPest(record.id);

  const row = el(
    'div',
    { className: 'timeline__item' },
    el(
      'div',
      { className: 'stack pest-row__body' },
      el(
        'div',
        { className: 'plant-card__meta' },
        el('span', {}, record.pestType),
        el('span', { className: `chip chip--${record.severity}` }, record.severity),
        el('span', { className: 'text-small text-muted' }, `observed ${relativeDate(record.observedAt)}`),
      ),
      record.notes ? el('p', { className: 'text-small text-muted' }, record.notes) : null,
      ...treatments.map((treatment) => treatmentLine(treatment, refresh)),
      el(
        'div',
        { className: 'dialog__actions' },
        el('button', { className: 'btn', onClick: () => treatFlow(record, plant, refresh) }, 'Treat…'),
        el(
          'button',
          {
            className: 'btn btn--ghost',
            onClick: async () => {
              await resolvePest(record.id);
              showToast(`${record.pestType} marked resolved`);
              refresh();
            },
          },
          'Resolved',
        ),
      ),
    ),
  );
  return row;
}

function treatmentLine(treatment, refresh) {
  const line = el(
    'p',
    { className: 'text-small' },
    `↳ ${treatment.product} (${treatment.type}) · ${relativeDate(treatment.appliedAt)} — `,
  );
  if (treatment.outcome) {
    line.append(el('span', { className: 'text-muted' }, treatment.outcome));
  } else {
    const outcomeSelect = el(
      'select',
      {
        className: 'field__control pest-row__outcome',
        'aria-label': `Outcome of ${treatment.product}`,
        onChange: async (event) => {
          if (!event.target.value) {
            return;
          }
          try {
            await recordOutcome(treatment.id, event.target.value);
            showToast('Outcome recorded — future you says thanks');
            refresh();
          } catch (error) {
            showToast(error.message);
          }
        },
      },
      el('option', { value: '' }, 'outcome?'),
      ...TREATMENT_OUTCOMES.map((o) => el('option', { value: o }, o)),
    );
    line.append(outcomeSelect);
  }
  return line;
}

async function reportFlow(plant, refresh) {
  const values = await formDialog({
    title: `Report a pest on ${plant.name}`,
    submitLabel: 'Report',
    fields: [
      { name: 'pestType', label: 'Pest / disease', required: true, suggestions: [...COMMON_PESTS], placeholder: 'mealybug' },
      { name: 'severity', label: 'Severity', kind: 'select', value: 'medium', options: PEST_SEVERITIES.map((s) => [s, s]) },
      { name: 'observedAt', label: 'Observed on', kind: 'date', value: localDateString() },
      { name: 'notes', label: 'Notes', kind: 'textarea' },
    ],
  });
  if (!values) {
    return;
  }
  try {
    await observePest({
      pestType: values.pestType,
      severity: values.severity,
      observedAt: values.observedAt ? new Date(`${values.observedAt}T12:00:00`).toISOString() : undefined,
      notes: values.notes,
      plantIds: [plant.id],
    });
    const worked = await whatWorkedFor(values.pestType);
    showToast(
      worked.length > 0
        ? `Reported. Last time, ${worked[0].product} was ${worked[0].outcome}.`
        : 'Pest reported — logged on the timeline',
    );
    refresh();
  } catch (error) {
    logger.error('Pest report failed', { error: error.message });
    showToast(error.message);
  }
}

async function treatFlow(record, plant, refresh) {
  const worked = await whatWorkedFor(record.pestType);
  const values = await formDialog({
    title: `Treat ${record.pestType}`,
    submitLabel: 'Log treatment',
    intro: worked.length > 0
      ? `Worked before: ${worked.slice(0, 3).map((t) => `${t.product} (${t.outcome})`).join(', ')}`
      : null,
    fields: [
      { name: 'product', label: 'Product', required: true, placeholder: 'Neem oil', suggestions: worked.map((t) => t.product) },
      { name: 'type', label: 'Type', kind: 'select', value: 'organic', options: TREATMENT_TYPES.map((t) => [t, t]) },
      { name: 'dose', label: 'Dose', placeholder: '5 ml / litre' },
      { name: 'method', label: 'Method', placeholder: 'foliar spray, evening' },
      { name: 'notes', label: 'Notes', kind: 'textarea' },
    ],
  });
  if (!values) {
    return;
  }
  try {
    await applyTreatment({ ...values, pestRecordId: record.id, plantIds: [plant.id] });
    showToast(`${values.product} logged against ${record.pestType}`);
    refresh();
  } catch (error) {
    logger.error('Treatment failed to log', { error: error.message });
    showToast(error.message);
  }
}
