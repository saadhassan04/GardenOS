/**
 * Fertilizer service (Business layer, L3) — PHASE2_HANDOFF §5.2.
 * "What did I use?" is derived from the events log, never stored, so it
 * cannot drift and needs no backup of its own.
 */

import { eventRepository } from '../database/EventRepository.js';
import { plantRepository } from '../database/PlantRepository.js';
import { listCareProfiles } from './careProfileService.js';
import { FERTILIZER_METHODS } from '../config/registries.js';

/** "Seaweed extract · 5 ml/L · foliar" from a fertilizing event's data. */
export function describeFeeding(d) {
  return [d.product, d.dose, d.method && FERTILIZER_METHODS[d.method]?.label.toLowerCase()].filter(Boolean).join(' · ');
}

/**
 * Pure core: distinct products from newest-first fertilizing events, latest
 * use wins; profile fertilizer text merged as suggestions (uses: 0).
 * @param {object[]} events newest first
 * @param {string[]} profileSuggestions
 */
export function summarizeProducts(events, profileSuggestions = []) {
  const byKey = new Map();
  for (const event of events) {
    const { product } = event.data ?? {};
    if (!product) {
      continue; // old bare events carry no product
    }
    const key = product.toLowerCase();
    const entry = byKey.get(key);
    if (entry) {
      entry.uses += 1;
    } else {
      const { npk = null, dose = null, method = null } = event.data;
      byKey.set(key, { product, npk, dose, method, lastUsedAt: event.occurredAt, uses: 1 });
    }
  }
  const products = [...byKey.values()]; // already newest first
  for (const text of profileSuggestions) {
    if (text && !byKey.has(text.toLowerCase())) {
      byKey.set(text.toLowerCase(), true);
      products.push({ product: text, npk: null, dose: null, method: null, lastUsedAt: null, uses: 0 });
    }
  }
  return products;
}

/** @returns {Promise<object[]>} see summarizeProducts */
export async function listUsedProducts() {
  const [events, profiles] = await Promise.all([
    eventRepository.listByType('fertilizing'),
    listCareProfiles(),
  ]);
  return summarizeProducts(events, profiles.map((p) => p.fertilizer));
}

/**
 * A plant's most recent feeding that named a product.
 * @param {string} plantId
 * @returns {Promise<{product: string, npk: string|null, dose: string|null, method: string|null}|null>}
 */
export async function lastFeeding(plantId) {
  const { items } = await eventRepository.getTimeline(plantId, { types: ['fertilizing'], limit: 20 });
  return items.find((event) => event.data?.product)?.data ?? null;
}

/**
 * Prefill for the fertilizer sheet: the plant's last feeding, else its
 * profile's fertilizer text, else the garden's most recent product.
 * @param {string|null} plantId null for bulk (garden-wide default)
 * @returns {Promise<{product: string, npk: string|null, dose: string|null, method: string|null}|null>}
 */
export async function defaultsForPlant(plantId) {
  if (plantId) {
    const last = await lastFeeding(plantId);
    if (last) {
      return last;
    }
    const plant = await plantRepository.get(plantId);
    const profile = plant?.careProfileId
      ? (await listCareProfiles()).find((p) => p.id === plant.careProfileId)
      : null;
    if (profile?.fertilizer) {
      return { product: profile.fertilizer, npk: null, dose: null, method: null };
    }
  }
  return (await listUsedProducts()).find((p) => p.uses > 0) ?? null;
}
