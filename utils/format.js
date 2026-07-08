/**
 * Pure formatting utilities (Platform layer, L1).
 * Display formatting only — persistence formats live in models (L2).
 */

/**
 * Human-readable byte size (storage displays, NFR-3.2).
 * @param {number} bytes
 * @returns {string} e.g. "1.4 MB"
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 100 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

/**
 * Percentage string from a ratio, clamped to [0, 100].
 * @param {number} ratio 0..1
 * @returns {string} e.g. "37%"
 */
export function formatPercent(ratio) {
  if (!Number.isFinite(ratio)) {
    return '—';
  }
  return `${Math.min(100, Math.max(0, Math.round(ratio * 100)))}%`;
}
