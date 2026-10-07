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

/** Local calendar date as YYYY-MM-DD (toISOString gives the UTC date — wrong near midnight). */
export function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * A date-input value → ISO timestamp. Today → the actual current moment; a
 * past date → noon local time of that day (can never be "in the future").
 */
export function dateToOccurredAt(dateValue, today = localDateString()) {
  if (!dateValue || dateValue === today) {
    return new Date().toISOString();
  }
  return new Date(`${dateValue}T12:00:00`).toISOString();
}
