/**
 * Test runner: executes all suites sequentially and renders results.
 * Open tests/index.html over HTTP (any static server) to run.
 * The suite uses a disposable "gardenos-test" database — the real
 * "gardenos" database is never touched.
 */

import { runAll } from './testKit.js';
import { prepareTestDatabase } from './database.test.js';
import './backup.test.js';
import './plants.test.js';
import './notes.test.js';
import './garden.test.js';
import './images.test.js';

const resultsEl = document.getElementById('results');
const summaryEl = document.getElementById('summary');

function renderResult({ name, ok, error, ms }) {
  const li = document.createElement('li');
  li.className = ok ? 'pass' : 'fail';
  li.textContent = `${ok ? '✓' : '✗'} ${name} (${ms.toFixed(0)} ms)`;
  if (error) {
    const detail = document.createElement('pre');
    detail.textContent = error.stack ?? error.message;
    li.append(detail);
  }
  resultsEl.append(li);
}

(async () => {
  try {
    // Progress goes through document.title as well: it is readable by
    // AppleScript-driven verification, and it pinpoints hangs (e.g. a
    // deleteDatabase blocked by a frozen bfcache tab holding the test DB).
    document.title = '⏳ preparing test database…';
    await prepareTestDatabase();
    document.title = '⏳ running…';
    let done = 0;
    const failures = [];
    const { passed, failed } = await runAll((result) => {
      done += 1;
      document.title = `⏳ ${done} run — ${result.ok ? 'ok' : 'FAILED'}: ${result.name.slice(0, 40)}`;
      if (!result.ok) {
        failures.push(`${result.name} → ${result.error.message}`);
      }
      renderResult(result);
    });
    summaryEl.textContent = `${passed} passed, ${failed} failed`;
    summaryEl.className = failed === 0 ? 'pass' : 'fail';
    document.title = failed === 0
      ? `✓ GardenOS tests — ${passed}/${passed + failed}`
      : `✗ ${passed}/${passed + failed} — ${failures.join(' | ')}`.slice(0, 180);
  } catch (error) {
    summaryEl.textContent = `Harness failure: ${error.message}`;
    summaryEl.className = 'fail';
    document.title = `✗ harness failure: ${error.message}`.slice(0, 90);
    throw error;
  }
})();
