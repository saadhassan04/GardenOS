/**
 * Run a log/complete action, then toast with Undo. Pages refresh themselves
 * from the bus events the services emit, so no refresh callback is needed.
 * @param {() => Promise<object>} run performs the action; its result goes to `undo`
 * @param {string} message toast text
 * @param {(result: object) => Promise<unknown>} [undo] defaults to undoing `result.batchId`
 */

import { showToast } from './Toast.js';
import { undoBatch } from '../services/careEventService.js';

export async function logWithUndo(run, message, undo = (result) => undoBatch(result.batchId)) {
  try {
    const result = await run();
    showToast(message, {
      actionLabel: 'Undo',
      onAction: () => undo(result).then(() => showToast('Undone'), (error) => showToast(error.message)),
    });
  } catch (error) {
    showToast(error.message);
  }
}
