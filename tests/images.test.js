/**
 * Image pipeline integration tests — v1.2 Image Manager.
 * Exercises the real canvas encode path (WebP or the JPEG fallback,
 * whichever this browser produces), the atomic ingest transaction, growth
 * gallery pagination, remove cascades, and storage accounting.
 */

import { test, assert, assertEqual, assertThrows } from './testKit.js';
import { createPlant, getPlant } from '../services/plantService.js';
import {
  ingestImage,
  removeImage,
  getImage,
  getGrowthSeries,
  setCover,
  getStorageStats,
} from '../services/imageService.js';
import { imageRepository } from '../database/ImageRepository.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

/**
 * A real encoded image blob of the given size (canvas → PNG), so ingest
 * exercises actual decode + re-encode.
 */
function makeTestImage(width, height, color = '#4CAF6D') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#0F1511';
  ctx.fillRect(0, 0, Math.max(1, width / 4), Math.max(1, height / 4));
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

test('should ingest a photo: re-encode, thumbnail, cover, and plant count', async () => {
  const plant = await createPlant({ name: 'Photo Test Plumeria' });
  const source = await makeTestImage(200, 100);

  const record = await ingestImage(source, { plantId: plant.id, caption: 'first leaf' });
  assertEqual(record.width, 200, 'small images must not be upscaled');
  assertEqual(record.height, 100);
  assert(
    record.mimeType === 'image/webp' || record.mimeType === 'image/jpeg',
    `re-encode must yield webp or jpeg, got ${record.mimeType}`,
  );
  assert(record.byteSize > 0 && record.blob.size === record.byteSize, 'byteSize must match blob');
  assertEqual(record.caption, 'first leaf');

  const thumb = await imageRepository.getThumbnail(record.id);
  assert(thumb && thumb.blob.size > 0, 'thumbnail must exist');
  assert(Math.max(thumb.width, thumb.height) <= 320, 'thumbnail must respect max dimension');

  const after = await getPlant(plant.id);
  assertEqual(after.derived.imageCount, 1);
  assertEqual(after.coverImageId, record.id, 'first photo becomes the cover');

  await assertThrows(
    () => ingestImage(new Blob(['not an image'], { type: 'text/plain' })),
    ValidationError,
  );
  await assertThrows(
    async () => ingestImage(await makeTestImage(10, 10), { plantId: 'no-such-plant' }),
    NotFoundError,
  );
});

test('should downscale oversized photos to the pipeline limits', async () => {
  const source = await makeTestImage(3000, 1500);
  const record = await ingestImage(source);
  assertEqual(record.width, 2048, 'longest edge must clamp to 2048');
  assertEqual(record.height, 1024, 'aspect ratio must be preserved');
  const thumb = await imageRepository.getThumbnail(record.id);
  assertEqual(Math.max(thumb.width, thumb.height), 320);
  await removeImage(record.id); // keep the test DB lean
});

test('should page the growth gallery newest-capture-first', async () => {
  const plant = await createPlant({ name: 'Gallery Test Rose' });
  for (const day of ['01', '02', '03']) {
    await ingestImage(await makeTestImage(40, 40), {
      plantId: plant.id,
      capturedAt: `2026-06-${day}T09:00:00.000Z`,
    });
  }

  const page1 = await getGrowthSeries(plant.id, { limit: 2 });
  assertEqual(page1.items.map((r) => r.capturedAt.slice(8, 10)), ['03', '02']);
  const page2 = await getGrowthSeries(plant.id, { limit: 2, cursor: page1.nextCursor });
  assertEqual(page2.items.map((r) => r.capturedAt.slice(8, 10)), ['01']);
  assertEqual(page2.nextCursor, null);
});

test('should cascade thumbnail and cover on photo removal', async () => {
  const plant = await createPlant({ name: 'Removal Test Fern' });
  const record = await ingestImage(await makeTestImage(50, 50), { plantId: plant.id });
  assertEqual((await getPlant(plant.id)).coverImageId, record.id);

  await removeImage(record.id);
  assertEqual(await getImage(record.id), null);
  assertEqual(await imageRepository.getThumbnail(record.id), null, 'thumbnail must cascade');
  const after = await getPlant(plant.id);
  assertEqual(after.derived.imageCount, 0);
  assertEqual(after.coverImageId, null, 'cover slot must empty, not dangle');
});

test('should reassign covers and account storage per plant', async () => {
  const plant = await createPlant({ name: 'Cover Test Palm' });
  const first = await ingestImage(await makeTestImage(50, 50), { plantId: plant.id });
  const second = await ingestImage(await makeTestImage(60, 60), { plantId: plant.id });
  assertEqual((await getPlant(plant.id)).coverImageId, first.id, 'first stays cover by default');

  await setCover(plant.id, second.id);
  assertEqual((await getPlant(plant.id)).coverImageId, second.id);

  const stranger = await createPlant({ name: 'Stranger Plant' });
  await assertThrows(() => setCover(stranger.id, second.id), NotFoundError);

  const stats = await getStorageStats();
  assert(stats.count >= 2 && stats.totalBytes > 0, 'global stats must count photos');
  const entry = stats.perPlant[plant.id];
  assertEqual(entry.count, 2, 'per-plant stats must count this plant\'s photos');
  assertEqual(entry.bytes, first.byteSize + second.byteSize);
});
