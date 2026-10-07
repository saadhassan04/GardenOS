/**
 * Harvest sheet (UI layer, L5) — logs a harvest for a sowing batch or a
 * plant (PHASE2_HANDOFF §6 step 3). Shared by the kitchen garden and the
 * plant detail page.
 */

import { formDialog } from './FormDialog.js';
import { showToast } from './Toast.js';
import { HARVEST_UNITS, HARVEST_QUALITIES } from '../models/Harvest.js';
import { logHarvest } from '../services/kitchenGardenService.js';
import { localDateString, dateToOccurredAt } from '../utils/dates.js';

/**
 * @param {{crop: string, sowingBatchId?: string, plantId?: string}} target
 * @returns {Promise<boolean>} true when logged
 */
export async function harvestFlow({ crop, sowingBatchId, plantId }) {
  const values = await formDialog({
    title: `Harvest ${crop}`,
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
    return false;
  }
  try {
    await logHarvest({
      sowingBatchId,
      plantId,
      crop,
      quantity: Number(values.quantity),
      unit: values.unit,
      quality: values.quality,
      harvestedAt: dateToOccurredAt(values.harvestedAt),
      notes: values.notes,
    });
    showToast(`${values.quantity} ${values.unit} of ${crop} logged`);
    return true;
  } catch (error) {
    showToast(error.message);
    return false;
  }
}
