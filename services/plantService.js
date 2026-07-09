/**
 * Plant service (Business layer, L3) — API_DESIGN.md §2, FR-1, T-032.
 * All plant lifecycle rules live here: creation/edit validation, archive
 * vs. soft delete vs. permanent delete semantics, and list shaping.
 */

import { validatePlant } from '../models/Plant.js';
import { plantRepository } from '../database/PlantRepository.js';
import { bus } from '../hooks/bus.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { PLANT_STATUSES } from '../config/registries.js';

/**
 * @param {object} input at minimum {name}
 * @returns {Promise<object>} the created plant
 */
export async function createPlant(input) {
  const plant = await plantRepository.add(validatePlant(input));
  bus.emit('plant:created', { plantId: plant.id });
  return plant;
}

/**
 * Merge-edit a plant; the merged result is re-validated as a whole so no
 * partial patch can produce an invalid record.
 * @param {string} plantId
 * @param {object} patch
 * @returns {Promise<object>} the updated plant
 */
export async function updatePlant(plantId, patch) {
  const existing = await plantRepository.get(plantId);
  if (!existing) {
    throw new NotFoundError('That plant no longer exists');
  }
  const merged = validatePlant({ ...existing, ...patch });
  // Derived caches are owned by careEventService, never by edits.
  merged.derived = existing.derived;
  const updated = await plantRepository.update(plantId, merged);
  bus.emit('plant:updated', { plantId });
  return updated;
}

/**
 * Status transition (archive, dormant, deceased, back to active) —
 * history always preserved (FR-1.5).
 * @param {string} plantId
 * @param {string} status PLANT_STATUSES key
 */
export async function setPlantStatus(plantId, status) {
  if (!(status in PLANT_STATUSES)) {
    throw new ValidationError(`Unknown plant status "${status}"`);
  }
  const updated = await plantRepository.setStatus(plantId, status);
  bus.emit(status === 'archived' ? 'plant:archived' : 'plant:updated', { plantId });
  return updated;
}

/**
 * Default deletion: tombstone the plant, keep all history (NFR-4.3).
 * @param {string} plantId
 */
export async function softDeletePlant(plantId) {
  await plantRepository.softDelete(plantId);
  bus.emit('plant:deleted', { plantId, permanent: false });
}

/**
 * Permanent deletion with event cascade — UI must confirm explicitly,
 * naming the record counts (FR-1.5, UI_GUIDELINES.md §7).
 * @param {string} plantId
 * @returns {Promise<{deletedEvents: number}>}
 */
export async function deletePlantPermanently(plantId) {
  const result = await plantRepository.hardDeleteCascade(plantId);
  bus.emit('plant:deleted', { plantId, permanent: true });
  return result;
}

/** @param {string} plantId @returns {Promise<object|null>} */
export function getPlant(plantId) {
  return plantRepository.get(plantId);
}

/**
 * Propagation lineage (FR-1.6): the chain of ancestors this plant was
 * grown from, and the cuttings/divisions grown from it.
 * @param {string} plantId
 * @returns {Promise<{ancestors: object[], children: object[]}>}
 *   ancestors ordered nearest-first (parent, grandparent, …)
 */
export async function getLineage(plantId) {
  const ancestors = [];
  const seen = new Set([plantId]);
  let current = await plantRepository.get(plantId);
  while (current?.parentPlantId && !seen.has(current.parentPlantId)) {
    seen.add(current.parentPlantId);
    const parent = await plantRepository.get(current.parentPlantId);
    if (!parent) {
      break; // parent was permanently deleted — chain ends here
    }
    ancestors.push(parent);
    current = parent;
  }

  const { items: children } = await plantRepository.query({
    index: 'parentPlantId',
    range: IDBKeyRange.only(plantId),
    limit: 200,
  });
  return { ancestors, children };
}

/**
 * Shaped plant list for the Plants screen (FR-1.4).
 * @param {{status?: string, category?: string|null, search?: string,
 *          sort?: 'name'|'newest'}} [options]
 * @returns {Promise<object[]>}
 */
export async function listPlants({ status = 'active', category = null, search = '', sort = 'name' } = {}) {
  let plants = await plantRepository.listByStatus(status);

  if (category) {
    plants = plants.filter((plant) => plant.category === category);
  }
  const needle = search.trim().toLowerCase();
  if (needle) {
    plants = plants.filter(
      (plant) =>
        plant.name.toLowerCase().includes(needle)
        || plant.botanicalName.toLowerCase().includes(needle),
    );
  }

  plants.sort(
    sort === 'newest'
      ? (a, b) => b.createdAt.localeCompare(a.createdAt)
      : (a, b) => a.name.localeCompare(b.name),
  );
  return plants;
}
