/**
 * Locations service (Business layer, L3) — T-039, DATABASE.md §3.11.
 * Garden area CRUD with the referential rule repositories can't own:
 * a location with plants assigned cannot be deleted.
 */

import { validateLocation } from '../models/Location.js';
import { Repository } from '../database/Repository.js';
import { plantRepository } from '../database/PlantRepository.js';
import { STORES } from '../database/stores.js';
import { bus } from '../hooks/bus.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const locationRepository = new Repository(STORES.locations);

/** @param {object} input @returns {Promise<object>} */
export async function createLocation(input) {
  const location = await locationRepository.add(validateLocation(input));
  bus.emit('location:created', { locationId: location.id });
  return location;
}

/** @param {string} locationId @param {object} patch */
export async function updateLocation(locationId, patch) {
  const existing = await locationRepository.get(locationId);
  if (!existing) {
    throw new NotFoundError('That location no longer exists');
  }
  const updated = await locationRepository.update(
    locationId,
    validateLocation({ ...existing, ...patch }),
  );
  bus.emit('location:updated', { locationId });
  return updated;
}

/**
 * Delete a location — refused while any plant (any status) still lives
 * there, so plants never point at a ghost (DATABASE.md §4).
 * @param {string} locationId
 */
export async function deleteLocation(locationId) {
  const residents = await countPlantsAt(locationId);
  if (residents > 0) {
    throw new ValidationError(
      `${residents} plant(s) are assigned to this location — move them first`,
    );
  }
  await locationRepository.softDelete(locationId);
  bus.emit('location:deleted', { locationId });
}

/** @param {string} locationId @returns {Promise<object|null>} */
export function getLocation(locationId) {
  return locationRepository.get(locationId);
}

/** @returns {Promise<object[]>} name-sorted locations */
export async function listLocations() {
  const { items } = await locationRepository.query({ limit: 500 });
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/** @param {string} locationId @returns {Promise<number>} plants assigned */
export function countPlantsAt(locationId) {
  return plantRepository.count({ index: 'locationId', range: IDBKeyRange.only(locationId) });
}
