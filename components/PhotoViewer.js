/**
 * Photo viewer dialog (UI layer, L5) — FR-6.
 * Full-resolution view with caption, capture date, cover selection,
 * caption editing, and confirmed deletion.
 */

import { el } from '../utils/dom.js';
import { showToast } from './Toast.js';
import { confirmDialog } from './ConfirmDialog.js';
import { formDialog } from './FormDialog.js';
import { formatDate } from '../utils/dates.js';
import { logger } from '../utils/logger.js';
import {
  getImage,
  removeImage,
  setCover,
  setCaption,
} from '../services/imageService.js';

/**
 * @param {string} imageId
 * @param {{onChange?: () => void}} [options] called after cover/caption/delete
 */
export async function openPhotoViewer(imageId, { onChange } = {}) {
  const record = await getImage(imageId);
  if (!record) {
    showToast('That photo no longer exists');
    return;
  }

  // Viewer-scoped URL: revoked the moment the dialog closes.
  const url = URL.createObjectURL(record.blob);

  const captionLine = el(
    'p',
    { className: 'text-small text-muted' },
    record.caption || 'No caption',
  );

  const dialog = el(
    'dialog',
    { className: 'dialog dialog--photo', 'aria-label': record.caption || 'Photo' },
    el('img', { className: 'photo-viewer__img', src: url, alt: record.caption || 'Garden photo' }),
    captionLine,
    el('p', { className: 'text-small text-muted' }, `Taken ${formatDate(record.capturedAt)} · ${record.width}×${record.height}`),
    el(
      'div',
      { className: 'dialog__actions' },
      record.plantId
        ? el(
            'button',
            {
              className: 'btn',
              onClick: async () => {
                await setCover(record.plantId, record.id);
                showToast('Set as cover photo');
                onChange?.();
              },
            },
            'Set as cover',
          )
        : null,
      el(
        'button',
        {
          className: 'btn',
          onClick: async () => {
            const values = await formDialog({
              title: 'Edit caption',
              submitLabel: 'Save',
              fields: [{ name: 'caption', label: 'Caption', value: record.caption }],
            });
            if (values) {
              await setCaption(record.id, values.caption);
              record.caption = values.caption.trim();
              captionLine.textContent = record.caption || 'No caption';
              onChange?.();
            }
          },
        },
        'Caption',
      ),
      el(
        'button',
        {
          className: 'btn btn--danger',
          onClick: async () => {
            const ok = await confirmDialog({
              title: 'Delete this photo?',
              body: 'The photo is removed from the garden permanently (it stays in old backups).',
              confirmLabel: 'Delete photo',
              danger: true,
            });
            if (!ok) {
              return;
            }
            try {
              await removeImage(record.id);
              showToast('Photo deleted');
              close();
              onChange?.();
            } catch (error) {
              logger.error('Photo delete failed', { error: error.message });
              showToast(error.message);
            }
          },
        },
        'Delete',
      ),
      el('button', { className: 'btn btn--primary', onClick: () => close() }, 'Close'),
    ),
  );

  const close = () => {
    dialog.close();
    dialog.remove();
    URL.revokeObjectURL(url);
  };
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });

  document.body.append(dialog);
  dialog.showModal();
}
