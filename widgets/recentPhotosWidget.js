/**
 * Recent photos widget (UI layer, L5) — FR-8.1.
 */

import { el } from '../utils/dom.js';
import { getAllPhotos } from '../services/imageService.js';
import { photoTile } from '../pages/GalleryPage.js';
import { registerWidget } from './registry.js';

registerWidget({
  id: 'recentPhotos',
  title: 'Recent photos',
  defaultOrder: 6,
  refreshOn: ['image:added', 'image:removed', 'backup:restored'],
  async render(container) {
    const { items } = await getAllPhotos({ limit: 6 });
    if (items.length === 0) {
      container.append(
        el('p', { className: 'text-small text-muted' }, 'No photos yet. ', el('a', { href: '#/gallery' }, 'Capture the first')),
      );
      return;
    }
    const strip = el('div', { className: 'photo-strip' });
    for (const record of items) {
      strip.append(await photoTile(record, () => {}));
    }
    container.append(strip, el('p', {}, el('a', { className: 'text-small', href: '#/gallery' }, 'All photos →')));
  },
});
