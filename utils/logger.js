/**
 * Local-only leveled logger with ring buffer (Platform layer, L1).
 * ARCHITECTURE.md §13: no telemetry, no network — entries stay on-device and
 * feed the Settings → Diagnostics view. Mirrors to the console for developers.
 */

const MAX_ENTRIES = 200;

/** @type {{at: string, level: string, message: string, details: unknown}[]} */
const ringBuffer = [];

/**
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} message
 * @param {unknown} [details]
 */
function record(level, message, details) {
  ringBuffer.push({ at: new Date().toISOString(), level, message, details: details ?? null });
  if (ringBuffer.length > MAX_ENTRIES) {
    ringBuffer.shift();
  }
  // eslint-disable-next-line no-console
  (console[level] || console.log)(`[GardenOS] ${message}`, details ?? '');
}

export const logger = {
  debug: (message, details) => record('debug', message, details),
  info: (message, details) => record('info', message, details),
  warn: (message, details) => record('warn', message, details),
  error: (message, details) => record('error', message, details),
};

/** Snapshot of recent log entries, newest last (Diagnostics view). */
export function getLogEntries() {
  return [...ringBuffer];
}

/** Capture unhandled failures into the ring buffer. Called once at bootstrap. */
export function installGlobalErrorCapture() {
  window.addEventListener('error', (event) => {
    record('error', `Unhandled error: ${event.message}`, {
      source: `${event.filename}:${event.lineno}`,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    record('error', 'Unhandled promise rejection', {
      reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
    });
  });
}
