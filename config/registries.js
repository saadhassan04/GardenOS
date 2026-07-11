/**
 * Domain registries (Platform layer, L1) — FR-1.2, FR-3.1, FR-3.3.
 * Extensible-by-configuration vocabularies: plant categories, statuses,
 * sun exposures, container types, and care event types. Adding an entry
 * here is the ONLY change needed to introduce a new event type or category
 * (Open/Closed — ARCHITECTURE.md D8 spirit).
 */

export const PLANT_CATEGORIES = Object.freeze({
  flower: { label: 'Flower' },
  foliage: { label: 'Foliage / Ornamental' },
  succulent: { label: 'Succulents & Cacti' },
  shrub: { label: 'Shrubs' },
  climber: { label: 'Climbers & Vines' },
  tree: { label: 'Tree' },
  bonsai: { label: 'Bonsai' },
  bulb: { label: 'Bulbs & Rhizomes' },
  herb: { label: 'Herb' },
  vegetable: { label: 'Vegetable' },
  indoor: { label: 'Indoor' },
  outdoor: { label: 'Outdoor' },
  seedling: { label: 'Seedling' },
  propagation: { label: 'Propagation' },
});

export const PLANT_STATUSES = Object.freeze({
  active: { label: 'Active' },
  dormant: { label: 'Dormant' },
  archived: { label: 'Archived' },
  deceased: { label: 'Deceased' },
});

export const SUN_EXPOSURES = Object.freeze({
  'full': { label: 'Full sun' },
  'partial': { label: 'Partial sun' },
  'shade': { label: 'Shade' },
  'indoor-bright': { label: 'Indoor · bright' },
  'indoor-low': { label: 'Indoor · low light' },
});

export const CONTAINER_TYPES = Object.freeze({
  'clay-pot': { label: 'Clay pot' },
  'plastic-pot': { label: 'Plastic pot' },
  'cement-pot': { label: 'Cement pot' },
  'grow-bag': { label: 'Grow bag' },
  'raised-bed': { label: 'Raised bed' },
  'ground': { label: 'In ground' },
});

/**
 * Care event types (DATABASE.md §3.2).
 * derivedField: which plants.derived cache this event type refreshes.
 * icon: sprite symbol id for timelines and buttons.
 * quickLog: shown as a one-tap action on the plant detail page.
 */
export const EVENT_TYPES = Object.freeze({
  'watering': { label: 'Watering', icon: 'drop', derivedField: 'lastWateredAt', quickLog: true },
  'fertilizing': { label: 'Fertilizing', icon: 'leaf', derivedField: 'lastFertilizedAt', quickLog: true },
  'repotting': { label: 'Repotting', icon: 'pot', derivedField: 'lastRepottedAt', quickLog: false },
  'pruning': { label: 'Pruning', icon: 'scissors', quickLog: true },
  'deadheading': { label: 'Deadheading', icon: 'scissors', quickLog: true },
  'pest-observation': { label: 'Pest observed', icon: 'bug', quickLog: false },
  'treatment': { label: 'Treatment', icon: 'spray', quickLog: false },
  'harvest': { label: 'Harvest', icon: 'basket', quickLog: false },
  'observation': { label: 'Observation', icon: 'note', quickLog: false },
  'stage-change': { label: 'Stage change', icon: 'leaf', quickLog: false },
  'planted': { label: 'Planted', icon: 'leaf', quickLog: false },
  'propagated': { label: 'Propagated', icon: 'leaf', quickLog: false },
  'moved': { label: 'Moved', icon: 'home', quickLog: false },
});
