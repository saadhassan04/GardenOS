/**
 * Blob ↔ base64 conversion (Platform layer, L1).
 * Backup archives are a single JSON file, so binary image data must survive
 * a text round-trip. Pure data transforms — no DOM, no app state.
 */

import { StorageError } from './errors.js';

/**
 * @param {Blob} blob
 * @returns {Promise<string>} base64 payload (no data-URL prefix)
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    reader.onerror = () =>
      reject(new StorageError('Failed to read blob for serialization', {
        cause: reader.error ?? undefined,
      }));
    reader.readAsDataURL(blob);
  });
}

/**
 * @param {string} base64
 * @param {string} type MIME type for the resulting Blob
 * @returns {Blob}
 */
export function base64ToBlob(base64, type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type });
}
