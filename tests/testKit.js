/**
 * Minimal in-browser test kit (tests only, never shipped in the app shell —
 * deliberately absent from the service-worker precache).
 * Zero dependencies, sequential execution, DOM-agnostic: the runner decides
 * how to display results.
 */

/** @type {{name: string, fn: () => void|Promise<void>}[]} */
const registered = [];

/**
 * Register a test. Naming convention: "should <behavior> when <condition>"
 * (CONTRIBUTING.md §7).
 * @param {string} name
 * @param {() => void|Promise<void>} fn
 */
export function test(name, fn) {
  registered.push({ name, fn });
}

/** @param {boolean} condition @param {string} [message] */
export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Deep structural equality (objects, arrays, primitives).
 * @param {*} actual @param {*} expected @param {string} [message]
 */
export function assertEqual(actual, expected, message) {
  if (!deepEqual(actual, expected)) {
    throw new Error(
      message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

/**
 * Assert an async or sync function throws, optionally of a given class.
 * @param {() => *} fn
 * @param {Function} [ErrorClass]
 */
export async function assertThrows(fn, ErrorClass) {
  try {
    await fn();
  } catch (error) {
    if (ErrorClass && !(error instanceof ErrorClass)) {
      throw new Error(`Expected ${ErrorClass.name}, got ${error.constructor.name}: ${error.message}`);
    }
    return error;
  }
  throw new Error(`Expected ${ErrorClass ? ErrorClass.name : 'an error'} to be thrown`);
}

/**
 * Run all registered tests sequentially.
 * @param {(result: {name: string, ok: boolean, error?: Error, ms: number}) => void} onResult
 * @returns {Promise<{passed: number, failed: number}>}
 */
export async function runAll(onResult) {
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of registered) {
    const start = performance.now();
    try {
      await fn();
      passed += 1;
      onResult({ name, ok: true, ms: performance.now() - start });
    } catch (error) {
      failed += 1;
      onResult({ name, ok: false, error, ms: performance.now() - start });
    }
  }
  return { passed, failed };
}

function deepEqual(a, b) {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  return keysA.every((key) => deepEqual(a[key], b[key]));
}
