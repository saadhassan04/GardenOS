/**
 * Image service (Business layer, L3) — API_DESIGN.md §5, FR-6, T-050.
 * The ingest pipeline: decode → downscale → re-encode (WebP, JPEG fallback
 * where the browser can't encode WebP — Safari) → thumbnail → one atomic
 * store. Also object-URL lifecycle, cover selection, captions, removal,
 * and storage accounting.
 */

import { validateImageRecord } from '../models/ImageRecord.js';
import { imageRepository } from '../database/ImageRepository.js';
import { plantRepository } from '../database/PlantRepository.js';
import { bus } from '../hooks/bus.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ValidationError, StorageError } from '../utils/errors.js';

/** Pipeline limits (NFR-2.3, DATABASE.md §8): re-encode keeps backups sane. */
const MAX_FULL_DIM = 2048;
const MAX_THUMB_DIM = 320;
const FULL_QUALITY = 0.82;
const THUMB_QUALITY = 0.7;

/**
 * Ingest a photo from camera or file picker (FR-6.1).
 * capturedAt precedence: explicit option → file's lastModified (camera files
 * carry the shot time there) → now. Full EXIF parsing is deferred until AI
 * needs it (FR-11.1).
 * @param {File|Blob} file
 * @param {{plantId?: string, eventId?: string, noteId?: string,
 *          capturedAt?: string, caption?: string}} [options]
 * @returns {Promise<object>} the stored image record
 */
export async function ingestImage(file, options = {}) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (error) {
    throw new ValidationError('That file is not a readable image', { cause: error });
  }

  const fullCanvas = drawScaled(bitmap, MAX_FULL_DIM);
  const thumbCanvas = drawScaled(bitmap, MAX_THUMB_DIM);
  bitmap.close?.();

  const [fullBlob, thumbBlob] = await Promise.all([
    encodeCanvas(fullCanvas, FULL_QUALITY),
    encodeCanvas(thumbCanvas, THUMB_QUALITY),
  ]);

  const capturedAt =
    options.capturedAt
    ?? (file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString());

  const body = validateImageRecord({
    blob: fullBlob,
    width: fullCanvas.width,
    height: fullCanvas.height,
    capturedAt,
    plantId: options.plantId ?? null,
    eventId: options.eventId ?? null,
    noteId: options.noteId ?? null,
    caption: options.caption ?? '',
  });

  const record = await imageRepository.ingest(body, thumbBlob, {
    width: thumbCanvas.width,
    height: thumbCanvas.height,
  });
  logger.info(`Photo stored (${record.byteSize} bytes, ${record.mimeType})`);
  bus.emit('image:added', { imageId: record.id, plantId: record.plantId });
  return record;
}

/** @param {string} imageId */
export async function removeImage(imageId) {
  const record = await imageRepository.removeCascade(imageId);
  bus.emit('image:removed', { imageId, plantId: record.plantId });
}

/** @param {string} imageId @returns {Promise<object|null>} */
export function getImage(imageId) {
  return imageRepository.get(imageId);
}

/** Growth gallery for one plant, newest first (FR-6.4). */
export function getGrowthSeries(plantId, options) {
  return imageRepository.getGrowthSeries(plantId, options);
}

/** All photos, newest first. */
export function getAllPhotos(options) {
  return imageRepository.getAllPhotos(options);
}

/**
 * Choose a plant's cover photo (FR-6.2).
 * @param {string} plantId @param {string} imageId
 */
export async function setCover(plantId, imageId) {
  const image = await imageRepository.get(imageId);
  if (!image || image.plantId !== plantId) {
    throw new NotFoundError('That photo does not belong to this plant');
  }
  await plantRepository.update(plantId, { coverImageId: imageId });
  bus.emit('plant:updated', { plantId });
}

/** @param {string} imageId @param {string} caption */
export async function setCaption(imageId, caption) {
  await imageRepository.update(imageId, { caption: caption.trim() });
}

/**
 * Photo storage accounting (FR-6.5, T-053).
 * @returns {Promise<{count: number, totalBytes: number,
 *                    perPlant: Record<string, {count: number, bytes: number}>}>}
 */
export async function getStorageStats() {
  const stats = { count: 0, totalBytes: 0, perPlant: {} };
  await imageRepository.exportAll((batch) => {
    for (const record of batch) {
      if (record.deletedAt) {
        continue;
      }
      // Fallbacks: hand-imported or pre-v1.2 records may lack byteSize.
      const bytes = record.byteSize ?? record.blob?.size ?? 0;
      stats.count += 1;
      stats.totalBytes += bytes;
      if (record.plantId) {
        const entry = (stats.perPlant[record.plantId] ??= { count: 0, bytes: 0 });
        entry.count += 1;
        entry.bytes += bytes;
      }
    }
  });
  return stats;
}

/* ---- Object URL lifecycle ----
 * URLs are registered per page and revoked wholesale on navigation, so
 * galleries never leak blob references (pages have no unmount hook). */

/** @type {string[]} */
let liveUrls = [];

bus.on('route:changed', () => {
  for (const url of liveUrls) {
    URL.revokeObjectURL(url);
  }
  liveUrls = [];
});

/**
 * An object URL that lives until the next route change.
 * @param {Blob} blob
 * @returns {string}
 */
export function pageScopedUrl(blob) {
  const url = URL.createObjectURL(blob);
  liveUrls.push(url);
  return url;
}

/**
 * Page-scoped object URL for an image's thumbnail.
 * @param {string} imageId
 * @returns {Promise<string|null>}
 */
export async function thumbnailUrl(imageId) {
  const thumb = await imageRepository.getThumbnail(imageId);
  return thumb ? pageScopedUrl(thumb.blob) : null;
}

/* ---- Encoding helpers ---- */

function drawScaled(bitmap, maxDim) {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * WebP where the browser can encode it; JPEG fallback otherwise (Safari
 * returns a PNG or null for unsupported toBlob types — both trigger the
 * fallback so stored sizes stay predictable).
 */
function encodeCanvas(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((webp) => {
      if (webp && webp.type === 'image/webp') {
        resolve(webp);
        return;
      }
      canvas.toBlob((jpeg) => {
        if (jpeg && jpeg.type === 'image/jpeg') {
          resolve(jpeg);
        } else {
          reject(new StorageError('This browser could not encode the image'));
        }
      }, 'image/jpeg', quality);
    }, 'image/webp', quality);
  });
}
