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
 * Offer a Blob to the phone's share sheet (Drive, WhatsApp, email, Nearby
 * Share…). Tries application/json, then text/plain: Android Chrome refuses
 * to share some types, and the filename keeps its .json extension either way.
 * @param {Blob} blob
 * @param {string} filename
 * @returns {Promise<'shared'|'cancelled'|'blocked'|'unsupported'>} `blocked`
 *   means the browser wants a fresh tap (the share must start within a few
 *   seconds of one, and building a big backup can outlast that).
 */
export async function tryShare(blob, filename) {
  for (const type of ['application/json', 'text/plain']) {
    const file = new File([blob], filename, { type });
    if (!navigator.canShare?.({ files: [file] })) {
      continue;
    }
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (error) {
      if (error.name === 'AbortError') {
        return 'cancelled';
      }
      if (error.name === 'NotAllowedError') {
        return 'blocked';
      }
    }
  }
  return 'unsupported';
}

/** @returns {boolean} true when this browser offers a file share sheet (phones) */
export function canShareFiles() {
  return ['application/json', 'text/plain'].some((type) =>
    navigator.canShare?.({ files: [new File(['{}'], 'x.json', { type })] }));
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
