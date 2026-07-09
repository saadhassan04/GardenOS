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
    await prepareTestDatabase();
    const { passed, failed } = await runAll(renderResult);
    summaryEl.textContent = `${passed} passed, ${failed} failed`;
    summaryEl.className = failed === 0 ? 'pass' : 'fail';
    document.title = `${failed === 0 ? '✓' : '✗'} GardenOS tests — ${passed}/${passed + failed}`;
  } catch (error) {
    summaryEl.textContent = `Harness failure: ${error.message}`;
    summaryEl.className = 'fail';
    throw error;
  }
})();
