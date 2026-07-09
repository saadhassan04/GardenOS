/**
 * Plant model (Data layer, L2) — DATABASE.md §3.1, FR-1.2.
 * The single place a plant's shape is defined and validated. Only `name`
 * is mandatory (US-A1); everything else defaults sensibly and can be
 * edited later. Nothing invalid reaches a repository (ARCHITECTURE.md §13).
 */

import { ValidationError } from '../utils/errors.js';
import {
  PLANT_CATEGORIES,
  PLANT_STATUSES,
  SUN_EXPOSURES,
  CONTAINER_TYPES,
} from '../config/registries.js';

/**
 * Validate and normalize plant input into the full persisted shape.
 * @param {object} input user-supplied fields (create: partial; update: full merged record)
 * @returns {object} a complete, valid plant record body (envelope excluded)
 * @throws {ValidationError}
 */
export function validatePlant(input) {
  if (input === null || typeof input !== 'object') {
    throw new ValidationError('Plant input must be an object');
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw new ValidationError('A plant needs a name');
  }

  const category = input.category ?? null;
  if (category !== null && !(category in PLANT_CATEGORIES)) {
    throw new ValidationError(`Unknown plant category "${category}"`);
  }

  const status = input.status ?? 'active';
  if (!(status in PLANT_STATUSES)) {
    throw new ValidationError(`Unknown plant status "${status}"`);
  }

  const sunExposure = input.location?.sunExposure ?? null;
  if (sunExposure !== null && !(sunExposure in SUN_EXPOSURES)) {
    throw new ValidationError(`Unknown sun exposure "${sunExposure}"`);
  }

  let container = input.container ?? null;
  if (container !== null) {
    if (!(container.type in CONTAINER_TYPES)) {
      throw new ValidationError(`Unknown container type "${container.type}"`);
    }
    const sizeInches = container.sizeInches ?? null;
    if (sizeInches !== null && (!Number.isFinite(sizeInches) || sizeInches <= 0)) {
      throw new ValidationError('Container size must be a positive number of inches');
    }
    container = { type: container.type, sizeInches, drainage: Boolean(container.drainage ?? true) };
  }

  const acquiredAt = input.acquiredAt ?? null;
  if (acquiredAt !== null && Number.isNaN(Date.parse(acquiredAt))) {
    throw new ValidationError('Acquired date is not a valid date');
  }

  return {
    name,
    botanicalName: (input.botanicalName ?? '').trim(),
    category,
    status,
    acquiredAt,
    parentPlantId: input.parentPlantId ?? null,
    locationId: input.locationId ?? null,
    location: {
      areaId: input.location?.areaId ?? null,
      position: input.location?.position ?? null,
      sunExposure,
    },
    container,
    soilMix: (input.soilMix ?? '').trim(),
    careProfileId: input.careProfileId ?? null,
    careOverrides: input.careOverrides ?? null,
    derived: {
      lastWateredAt: input.derived?.lastWateredAt ?? null,
      lastFertilizedAt: input.derived?.lastFertilizedAt ?? null,
      lastRepottedAt: input.derived?.lastRepottedAt ?? null,
      eventCount: input.derived?.eventCount ?? 0,
      imageCount: input.derived?.imageCount ?? 0,
    },
    coverImageId: input.coverImageId ?? null,
    tags: Array.isArray(input.tags) ? input.tags.filter((t) => typeof t === 'string') : [],
    notes: (input.notes ?? '').trim(),
  };
}
