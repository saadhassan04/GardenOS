/**
 * Checksum utilities (Platform layer, L1).
 * Backup archives are integrity-checked with SHA-256 before any restore
 * touches live data (NFR-4.4).
 */

/**
 * SHA-256 of a string, hex-encoded.
 * @param {string} text
 * @returns {Promise<string>} 64-char lowercase hex digest
 */
export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
