/**
 * File download / file picking helpers (UI layer, L5).
 * The single place the app hands files to, or receives files from, the
 * user's device. Services stay DOM-free and deal only in Blobs.
 */

import { el } from '../utils/dom.js';

/**
 * Trigger a browser download of a Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = el('a', { href: url, download: filename });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Late revocation: some browsers start the download asynchronously.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Hand a Blob to the user: the phone's share sheet (Drive, WhatsApp, email,
 * Nearby Share…) when the browser can share files, otherwise a download.
 * @param {Blob} blob
 * @param {string} filename
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (error) {
      if (error.name === 'AbortError') {
        return 'cancelled';
      }
      // Share failed (unsupported type, etc.) — fall through to a download.
    }
  }
  triggerDownload(blob, filename);
  return 'downloaded';
}

/** @returns {boolean} true when this browser offers a file share sheet (phones) */
export function canShareFiles() {
  return Boolean(navigator.canShare?.({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }));
}

/**
 * Ask the user to pick a single file.
 * @param {string} accept input accept attribute, e.g. ".json,application/json"
 * @param {{capture?: 'environment'|'user'}} [options] mobile browsers open
 *   the camera directly when capture is set (photo logging in the garden)
 * @returns {Promise<File|null>} null when the picker is dismissed
 */
export function pickFile(accept, options = {}) {
  return new Promise((resolve) => {
    const input = el('input', {
      type: 'file',
      accept,
      capture: options.capture ?? null,
      className: 'visually-hidden',
    });
    const finish = (file) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    // "cancel" fires in current browsers; older ones simply leak one hidden
    // input until the next pick — harmless.
    input.addEventListener('cancel', () => finish(null));
    document.body.append(input);
    input.click();
  });
}
