/**
 * Internal event bus (Application layer, L4) — ARCHITECTURE.md D7.
 * Modules communicate exclusively through namespaced topics documented in
 * API_DESIGN.md §11. Payloads carry ids, not full records.
 */

import { logger } from '../utils/logger.js';

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

export const bus = {
  /**
   * Subscribe to a topic.
   * @param {string} topic e.g. "settings:changed"
   * @param {(payload: object) => void} handler
   * @returns {() => void} unsubscribe function — callers MUST invoke it when
   *   their view is torn down (unsubscribe hygiene, CONTRIBUTING.md).
   */
  on(topic, handler) {
    if (!listeners.has(topic)) {
      listeners.set(topic, new Set());
    }
    listeners.get(topic).add(handler);
    return () => listeners.get(topic)?.delete(handler);
  },

  /**
   * Publish to a topic. Handler failures are isolated and logged so one
   * broken subscriber never breaks the publisher or its siblings.
   * @param {string} topic
   * @param {object} [payload]
   */
  emit(topic, payload = {}) {
    const subscribers = listeners.get(topic);
    if (!subscribers) {
      return;
    }
    for (const handler of subscribers) {
      try {
        handler(payload);
      } catch (error) {
        logger.error(`Bus handler failed for "${topic}"`, { error: error.message });
      }
    }
  },
};
