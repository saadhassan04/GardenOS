/**
 * Kitchen garden page (UI layer, L5) — FR-5, T-061/T-062.
 * Sow-this-month suggestions, active sowing batches with day counters and
 * stage advancement, harvest logging, and the season's yield totals.
 */

import { el, svgIcon, clear } from '../utils/dom.js';
import { showToast } from '../components/Toast.js';
import { formDialog } from '../components/FormDialog.js';
import { formatDate, localDateString } from '../utils/dates.js';
import { logger } from '../utils/logger.js';
import { SOWING_STAGES, STAGE_LABELS } from '../models/SowingBatch.js';
import { HARVEST_UNITS, HARVEST_QUALITIES } from '../models/Harvest.js';
import {
  createBatch,
  advanceStage,
  listBatches,
  logHarvest,
  getYield,
  currentGrowingSeason,
} from '../services/kitchenGardenService.js';
import {
  getSowingSuggestions,
  listAllCropNames,
  saveCustomCrop,
} from '../services/sowingCalendarService.js';

const DAY_MS = 86_400_000;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** @returns {HTMLElement} */
export function renderKitchenGardenPage() {
  const page = el('div', {});
  const state = { includeFinished: false };

  const sowButton = el(
    'button',
    { className: 'btn btn--primary', onClick: () => newSowingFlow(refresh) },
    svgIcon('plus', { size: 20 }),
    'New sowing',
  );

  page.append(
    el('header', { className: 'page-header page-header--split' }, el('h1', {}, 'Kitchen garden'), sowButton),
  );

  const calendarCard = el('div', { className: 'card stack' });
  const batchesRegion = el('div', { className: 'stack' });
  const yieldCard = el('div', { className: 'card' });
  const season = currentGrowingSeason();

  const finishedToggle = el(
    'button',
    {
      className: 'btn btn--ghost',
      onClick: () => {
        state.includeFinished = !state.includeFinished;
        finishedToggle.textContent = state.includeFinished ? 'Hide finished batches' : 'Show finished batches';
        refresh();
      },
    },
    'Show finished batches',
  );

  page.append(
    section(`Sow in ${MONTH_NAMES[new Date().getMonth()]}`, calendarCard),
    section('Sowing batches', el('div', { className: 'stack' }, batchesRegion, el('div', { className: 'dialog__actions' }, finishedToggle))),
    section(`Harvest — ${season.label}`, yieldCard),
  );

  async function refresh() {
    fillCalendar(calendarCard, refresh);
    fillBatches(batchesRegion, state, refresh);
    fillYield(yieldCard, season);
  }

  refresh();
  return page;
}

function section(title, body) {
  return el(
    'section',
    { className: 'page-section' },
    el('span', { className: 'text-caption' }, title),
    body,
  );
}

async function fillCalendar(card, refresh) {
  try {
    const suggestions = await getSowingSuggestions();
    clear(card);
    if (suggestions.length === 0) {
      card.append(el('p', { className: 'text-small text-muted' }, 'Nothing on the calendar this month — a rest month for the sower.'));
    } else {
      card.append(
        el(
          'div',
          { className: 'plant-card__meta' },
          ...suggestions.map((entry) =>
            el('span', { className: 'chip', title: entry.notes || null }, entry.crop),
          ),
        ),
      );
      const noted = suggestions.filter((s) => s.notes).slice(0, 3);
      for (const entry of noted) {
        card.append(el('p', { className: 'text-small text-muted' }, `${entry.crop}: ${entry.notes}`));
      }
    }
    card.append(
      el(
        'div',
        { className: 'dialog__actions' },
        el(
          'button',
          {
            className: 'btn btn--ghost',
            onClick: async () => {
              const values = await formDialog({
                title: 'Add a crop to the calendar',
                submitLabel: 'Add crop',
                fields: [
                  { name: 'crop', label: 'Crop', required: true },
                  { name: 'months', label: 'Sowing months (1–12, comma-separated)', required: true, placeholder: '10, 11' },
                  { name: 'notes', label: 'Notes', kind: 'textarea' },
                ],
              });
              if (!values) {
                return;
              }
              try {
                await saveCustomCrop({
                  crop: values.crop,
                  months: values.months.split(',').map((m) => Number.parseInt(m.trim(), 10)),
                  notes: values.notes,
                });
                showToast(`${values.crop} added to your calendar`);
                refresh();
              } catch (error) {
                showToast(error.message);
              }
            },
          },
          'Add crop…',
        ),
      ),
    );
  } catch (error) {
    logger.error('Sowing calendar failed to load', { error: error.message });
  }
}

async function fillBatches(region, state, refresh) {
  try {
    const batches = await listBatches({ includeFinished: state.includeFinished });
    clear(region);
    if (batches.length === 0) {
      region.append(
        el('div', { className: 'card empty-state' }, el('p', {}, 'No sowing batches yet — start with "New sowing".')),
      );
      return;
    }
    region.append(...batches.map((batch) => batchCard(batch, refresh)));
  } catch (error) {
    logger.error('Batches failed to load', { error: error.message });
    clear(region);
    region.append(el('div', { className: 'card' }, `Could not load batches: ${error.message}`));
  }
}

function batchCard(batch, refresh) {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(batch.sownAt)) / DAY_MS));
  const finished = batch.stage === 'finished';

  return el(
    'div',
    { className: 'card note-card__head' },
    el(
      'div',
      {},
      el('h3', { className: 'plant-card__name' }, batch.variety ? `${batch.crop} · ${batch.variety}` : batch.crop),
      el(
        'div',
        { className: 'plant-card__meta' },
        el('span', { className: `chip${finished ? '' : ' chip--medium'}` }, STAGE_LABELS[batch.stage]),
        el('span', { className: 'text-small text-muted' }, `day ${days}`),
        batch.quantity ? el('span', { className: 'text-small text-muted' }, `${batch.quantity} sown`) : null,
        el('span', { className: 'text-small text-muted' }, `since ${formatDate(batch.sownAt)}`),
      ),
    ),
    finished
      ? el('span', {})
      : el(
          'div',
          { className: 'dialog__actions' },
          el('button', { className: 'btn', onClick: () => advanceFlow(batch, refresh) }, 'Stage…'),
          el('button', { className: 'btn', onClick: () => harvestFlow(batch, refresh) }, svgIcon('basket', { size: 18 }), 'Harvest…'),
        ),
  );
}

async function fillYield(card, season) {
  try {
    const { byCrop, entries } = await getYield({ from: season.from, to: season.to });
    clear(card);
    const crops = Object.keys(byCrop).sort();
    if (crops.length === 0) {
      card.append(el('p', { className: 'text-small text-muted' }, 'No harvests yet this season — they will tally here.'));
      return;
    }
    for (const crop of crops) {
      const totals = Object.entries(byCrop[crop])
        .map(([unit, qty]) => `${Math.round(qty * 100) / 100} ${unit}`)
        .join(' · ');
      card.append(
        el(
          'div',
          { className: 'status-row' },
          el('span', {}, crop),
          el('span', { className: 'status-row__value' }, totals),
        ),
      );
    }
    card.append(el('p', { className: 'text-small text-muted' }, `${entries} harvest entries this season.`));
  } catch (error) {
    logger.error('Yield failed to load', { error: error.message });
  }
}

async function newSowingFlow(refresh) {
  const cropNames = await listAllCropNames();
  const values = await formDialog({
    title: 'New sowing',
    submitLabel: 'Sow it',
    fields: [
      { name: 'crop', label: 'Crop', required: true, suggestions: cropNames },
      { name: 'variety', label: 'Variety', placeholder: 'Roma, desi…' },
      { name: 'quantity', label: 'How many (seeds/seedlings)', kind: 'number' },
      { name: 'sownAt', label: 'Sown on', kind: 'date', value: localDateString() },
      { name: 'medium', label: 'Where', placeholder: 'seed tray, direct bed, pot…' },
    ],
  });
  if (!values) {
    return;
  }
  try {
    await createBatch({
      crop: values.crop,
      variety: values.variety,
      quantity: values.quantity ? Number(values.quantity) : null,
      sownAt: values.sownAt ? new Date(`${values.sownAt}T12:00:00`).toISOString() : undefined,
      medium: values.medium,
    });
    showToast(`${values.crop} sown — day 0 of the story`);
    refresh();
  } catch (error) {
    showToast(error.message);
  }
}

async function advanceFlow(batch, refresh) {
  const currentIndex = SOWING_STAGES.indexOf(batch.stage);
  const laterStages = SOWING_STAGES.slice(currentIndex + 1);
  const values = await formDialog({
    title: `${batch.crop}: next stage`,
    submitLabel: 'Advance',
    fields: [
      {
        name: 'stage',
        label: 'Stage',
        kind: 'select',
        value: laterStages[0],
        options: laterStages.map((stage) => [stage, STAGE_LABELS[stage]]),
      },
      { name: 'at', label: 'When', kind: 'date', value: localDateString() },
    ],
  });
  if (!values) {
    return;
  }
  try {
    await advanceStage(batch.id, values.stage, {
      at: values.at ? new Date(`${values.at}T12:00:00`).toISOString() : undefined,
    });
    showToast(`${batch.crop} → ${STAGE_LABELS[values.stage]}`);
    refresh();
  } catch (error) {
    showToast(error.message);
  }
}

async function harvestFlow(batch, refresh) {
  const values = await formDialog({
    title: `Harvest ${batch.crop}`,
    submitLabel: 'Log harvest',
    fields: [
      { name: 'quantity', label: 'Quantity', kind: 'number', required: true },
      { name: 'unit', label: 'Unit', kind: 'select', value: 'kg', options: HARVEST_UNITS.map((u) => [u, u]) },
      { name: 'quality', label: 'Quality', kind: 'select', value: 'good', options: HARVEST_QUALITIES.map((q) => [q, q]) },
      { name: 'harvestedAt', label: 'Harvested on', kind: 'date', value: localDateString() },
      { name: 'notes', label: 'Notes', kind: 'textarea' },
    ],
  });
  if (!values) {
    return;
  }
  try {
    await logHarvest({
      sowingBatchId: batch.id,
      quantity: Number(values.quantity),
      unit: values.unit,
      quality: values.quality,
      harvestedAt: values.harvestedAt ? new Date(`${values.harvestedAt}T12:00:00`).toISOString() : undefined,
      notes: values.notes,
    });
    showToast(`${values.quantity} ${values.unit} of ${batch.crop} — well grown`);
    refresh();
  } catch (error) {
    showToast(error.message);
  }
}
