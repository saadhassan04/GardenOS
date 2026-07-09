/**
 * Date display utilities (Platform layer, L1) — UI_GUIDELINES.md §11:
 * relative under 7 days, absolute after. Persistence stays ISO-8601 UTC;
 * these are for display only.
 */

const DAY_MS = 86_400_000;

/**
 * @param {string|null} iso
 * @returns {string} "never" | "today" | "yesterday" | "N days ago" | absolute date
 */
export function relativeDate(iso) {
  if (!iso) {
    return 'never';
  }
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return 'never';
  }
  const days = Math.floor((Date.now() - then) / DAY_MS);
  if (days <= 0) {
    return 'today';
  }
  if (days === 1) {
    return 'yesterday';
  }
  if (days < 7) {
    return `${days} days ago`;
  }
  return formatDate(iso);
}

/**
 * @param {string} iso
 * @returns {string} locale-aware medium date, e.g. "Jul 9, 2026"
 */
export function formatDate(iso) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
}
