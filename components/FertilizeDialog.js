/**
 * Fertilizer sheet (UI layer, L5) — PHASE2_HANDOFF §5.2. One-tap "same as
 * last time", recent-product chips, and a short form. `feedFlow` is the
 * shared entry point (Today, plant detail, Plants bulk).
 */

import { el } from '../utils/dom.js';
import { FERTILIZER_METHODS } from '../config/registries.js';
import { localDateString, dateToOccurredAt } from '../utils/dates.js';
import { logWithUndo } from './logWithUndo.js';
import { logBulk } from '../services/careEventService.js';
import { listUsedProducts, defaultsForPlant, describeFeeding } from '../services/fertilizerService.js';


/**
 * Ask what was used, then log it for the plants with one Undo.
 * @param {string[]} plantIds
 * @param {string|null} [name] plant name for a single plant, else "N plants"
 * @returns {Promise<boolean>} true when logged
 */
export async function feedFlow(plantIds, name = null) {
  const label = name ?? `${plantIds.length} plants`;
  const [products, defaults] = await Promise.all([
    listUsedProducts(),
    defaultsForPlant(plantIds.length === 1 ? plantIds[0] : null),
  ]);
  const entry = await fertilizeDialog({ title: `Feed ${label}`, products, defaults });
  if (!entry) {
    return false;
  }
  await logWithUndo(() => logBulk(plantIds, 'fertilizing', entry), `Fed ${label}: ${entry.data.product}`);
  return true;
}

/**
 * @param {{title: string, products: object[], defaults: object|null}} options
 * @returns {Promise<null|{occurredAt: string, data: object}>}
 */
export function fertilizeDialog({ title, products, defaults }) {
  return new Promise((resolve) => {
    const today = localDateString();
    let method = defaults?.method ?? null;

    const input = (id, value, extra = {}) =>
      el('input', { className: 'field__control', id, value: value ?? '', ...extra });
    const product = input('fz-product', defaults?.product, { list: 'fz-products', required: '', placeholder: 'e.g. Seaweed extract' });
    const dose = input('fz-dose', defaults?.dose, { placeholder: 'e.g. 5 ml/L, 1 tsp/pot' });
    const npk = input('fz-npk', defaults?.npk, { placeholder: '20-20-20' });
    const date = input('fz-date', today, { type: 'date', max: today });
    const note = el('textarea', { className: 'field__control field__control--area', id: 'fz-note', rows: '2' });

    const keys = Object.keys(FERTILIZER_METHODS);
    const setMethod = (value) => {
      method = value;
      methodButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(keys[i] === method)));
    };
    const methodButtons = keys.map((key) =>
      el('button', {
        type: 'button',
        className: 'btn chip-btn',
        'aria-pressed': String(method === key),
        onClick: () => setMethod(method === key ? null : key), // tap again to clear
      }, FERTILIZER_METHODS[key].label),
    );

    const fill = (d) => {
      product.value = d.product ?? '';
      dose.value = d.dose ?? '';
      npk.value = d.npk ?? '';
      setMethod(d.method ?? null);
    };

    const entryFrom = (d, occurredAt = new Date().toISOString()) => ({
      occurredAt,
      data: { product: d.product, dose: d.dose || null, method: d.method ?? null, npk: d.npk || null },
    });

    const recent = products.filter((p) => p.uses > 0).slice(0, 6);
    const field = (label, id, control) => el('div', { className: 'field' }, el('label', { className: 'field__label', for: id }, label), control);

    const dialog = el(
      'dialog',
      { className: 'dialog dialog--sheet', 'aria-labelledby': 'fz-title' },
      el('h3', { className: 'dialog__title', id: 'fz-title' }, title),
      defaults
        ? el('button', { type: 'button', className: 'btn btn--primary', onClick: () => close(entryFrom(defaults)) }, `Same as last time: ${describeFeeding(defaults)}`)
        : null,
      el(
        'form',
        {
          className: 'stack',
          onSubmit: (event) => {
            event.preventDefault();
            const extra = note.value.trim() ? { note: note.value.trim() } : {};
            const { occurredAt, data } = entryFrom(
              { product: product.value.trim(), dose: dose.value.trim(), npk: npk.value.trim(), method },
              dateToOccurredAt(date.value, today),
            );
            close({ occurredAt, data: { ...data, ...extra } });
          },
        },
        recent.length
          ? el('div', { className: 'chip-row' }, ...recent.map((p) => el('button', { type: 'button', className: 'btn chip-btn', onClick: () => fill(p) }, p.product)))
          : null,
        field('Product', 'fz-product', product),
        el('datalist', { id: 'fz-products' }, ...products.map((p) => el('option', { value: p.product }))),
        field('Dose', 'fz-dose', dose),
        el('div', { className: 'chip-row' }, ...methodButtons),
        el(
          'details',
          {},
          el('summary', { className: 'text-small' }, 'More: NPK, date, note'),
          field('NPK', 'fz-npk', npk),
          field('Date', 'fz-date', date),
          field('Note', 'fz-note', note),
        ),
        el(
          'div',
          { className: 'dialog__actions' },
          el('button', { className: 'btn', type: 'button', onClick: () => close(null) }, 'Cancel'),
          el('button', { className: 'btn btn--primary', type: 'submit' }, 'Log feeding'),
        ),
      ),
    );

    const close = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close(null);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}
