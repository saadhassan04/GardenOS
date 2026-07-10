/**
 * Gallery page (UI layer, L5) — FR-6.4, T-051.
 * Every photo in the garden, newest first, paged. Thumbnails only — full
 * blobs load exclusively in the viewer.
 */

import { el, svgIcon, clear } from '../utils/dom.js';
import { showToast } from '../components/Toast.js';
import { pickFile } from '../components/fileTransfer.js';
import { openPhotoViewer } from '../components/PhotoViewer.js';
import {
  ingestImage,
  getAllPhotos,
  thumbnailUrl,
} from '../services/imageService.js';
import { logger } from '../utils/logger.js';

/** @returns {HTMLElement} */
export function renderGalleryPage() {
  const page = el('div', {});
  const state = { cursor: null };

  const addButton = el(
    'button',
    {
      className: 'btn btn--primary',
      onClick: async () => {
        const file = await pickFile('image/*', { capture: 'environment' });
        if (!file) {
          return;
        }
        try {
          await ingestImage(file);
          showToast('Photo added — link it to a plant from its page next time for the growth story');
          reset();
        } catch (error) {
          logger.error('Photo ingest failed', { error: error.message });
          showToast(error.message);
        }
      },
    },
    svgIcon('camera', { size: 20 }),
    'Add photo',
  );

  page.append(
    el('header', { className: 'page-header page-header--split' }, el('h1', {}, 'Gallery'), addButton),
  );

  const grid = el('div', { className: 'photo-grid' });
  const loadMoreBtn = el('button', { className: 'btn', onClick: () => load() }, 'Load more');
  const footer = el('div', { className: 'dialog__actions' }, loadMoreBtn);
  page.append(grid, footer);

  async function load() {
    try {
      const { items, nextCursor } = await getAllPhotos({ cursor: state.cursor, limit: 24 });
      if (items.length === 0 && grid.children.length === 0) {
        grid.append(
          el(
            'div',
            { className: 'card empty-state' },
            el('p', {}, 'No photos yet. The growth story starts with the first one.'),
          ),
        );
      }
      for (const record of items) {
        grid.append(await photoTile(record, reset));
      }
      state.cursor = nextCursor;
      footer.style.display = nextCursor ? '' : 'none';
    } catch (error) {
      logger.error('Gallery failed to load', { error: error.message });
      clear(grid);
      grid.append(el('div', { className: 'card' }, `Could not load photos: ${error.message}`));
    }
  }

  function reset() {
    state.cursor = null;
    clear(grid);
    load();
  }

  load();
  return page;
}

/**
 * A thumbnail tile that opens the viewer. Exported for the plant detail
 * page's growth strip.
 * @param {object} record image record
 * @param {() => void} onChange
 */
export async function photoTile(record, onChange) {
  const url = await thumbnailUrl(record.id);
  return el(
    'button',
    {
      className: 'photo-tile',
      'aria-label': record.caption || `Photo from ${record.capturedAt.slice(0, 10)}`,
      onClick: () => openPhotoViewer(record.id, { onChange }),
    },
    url
      ? el('img', { className: 'photo-tile__img', src: url, alt: '', loading: 'lazy' })
      : el('span', { className: 'text-small text-muted' }, '…'),
  );
}
