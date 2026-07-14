/**
 * Starter garden seed data (Data layer, L2) — the owner's documented
 * collection (PROJECT_REQUIREMENTS.md §1.1), planted automatically on a
 * fresh install so day one starts with the real garden, not an empty
 * screen. careProfileName resolves to the matching Karachi preset at seed
 * time. Plural entries in the spec ("multiple bougainvillea") seed one
 * plant each — duplicates are two taps in the app.
 */

export const KARACHI_STARTER_GARDEN = [
  { name: 'Black Plumeria', botanicalName: 'Plumeria rubra', category: 'flower', careProfileName: 'Plumeria (Karachi)' },
  { name: 'Thai Plumeria', botanicalName: 'Plumeria obtusa', category: 'flower', careProfileName: 'Plumeria (Karachi)' },
  { name: 'Plumeria', botanicalName: 'Plumeria', category: 'flower', careProfileName: 'Plumeria (Karachi)' },
  { name: 'Bougainvillea', botanicalName: 'Bougainvillea glabra', category: 'climber', careProfileName: 'Bougainvillea (Karachi)' },
  { name: 'Rose', botanicalName: 'Rosa indica', category: 'shrub', careProfileName: 'Rose — desi (Karachi)' },
  { name: 'Jasmine', botanicalName: 'Jasminum grandiflorum', category: 'climber', careProfileName: 'Jasmine / Motia (Karachi)' },
  { name: 'Motia', botanicalName: 'Jasminum sambac', category: 'shrub', careProfileName: 'Jasmine / Motia (Karachi)' },
  { name: 'Tulsi', botanicalName: 'Ocimum tenuiflorum', category: 'herb', careProfileName: 'Tulsi (Karachi)' },
  { name: 'Boston Fern', botanicalName: 'Nephrolepis exaltata', category: 'foliage', careProfileName: 'Boston Fern (Karachi)' },
  { name: 'Lady Palm', botanicalName: 'Rhapis excelsa', category: 'foliage', careProfileName: 'Palm — Areca / Lady / Malaysian (Karachi)' },
  { name: 'Areca Palm', botanicalName: 'Dypsis lutescens', category: 'foliage', careProfileName: 'Palm — Areca / Lady / Malaysian (Karachi)' },
  { name: 'Malaysian Palm', botanicalName: '', category: 'foliage', careProfileName: 'Palm — Areca / Lady / Malaysian (Karachi)' },
  { name: 'Snake Plant', botanicalName: 'Dracaena trifasciata', category: 'succulent', careProfileName: 'Snake Plant (Karachi)' },
  { name: 'Money Plant', botanicalName: 'Epipremnum aureum', category: 'climber', careProfileName: 'Money Plant / Pothos (Karachi)' },
  { name: 'Rubber Plant', botanicalName: 'Ficus elastica', category: 'foliage', careProfileName: 'Rubber Plant (Karachi)' },
  { name: 'African Hosta', botanicalName: 'Drimiopsis maculata', category: 'foliage', careProfileName: null },
  { name: 'Dieffenbachia', botanicalName: 'Dieffenbachia seguine', category: 'foliage', careProfileName: 'Dieffenbachia (Karachi)' },
  { name: 'Dracaena', botanicalName: 'Dracaena', category: 'foliage', careProfileName: 'Dracaena / Song of India (Karachi)' },
  { name: 'Song of India', botanicalName: 'Dracaena reflexa', category: 'foliage', careProfileName: 'Dracaena / Song of India (Karachi)' },
  { name: 'Curry Leaf', botanicalName: 'Murraya koenigii', category: 'tree', careProfileName: 'Curry Leaf (Karachi)' },
  { name: 'Lemon', botanicalName: 'Citrus limon', category: 'tree', careProfileName: 'Lemon / Citrus (Karachi)' },
  { name: 'Mint', botanicalName: 'Mentha', category: 'herb', careProfileName: 'Mint (Karachi)' },
  { name: 'Eggplant', botanicalName: '', category: 'vegetable', careProfileName: 'Kitchen garden vegetables (Karachi winter)' },
  { name: 'Green Chili', botanicalName: '', category: 'vegetable', careProfileName: 'Kitchen garden vegetables (Karachi winter)' },
  { name: 'Bell Pepper', botanicalName: '', category: 'vegetable', careProfileName: 'Kitchen garden vegetables (Karachi winter)' },
  { name: 'Broccoli', botanicalName: '', category: 'vegetable', careProfileName: 'Kitchen garden vegetables (Karachi winter)' },
  { name: 'Spinach', botanicalName: '', category: 'vegetable', careProfileName: 'Kitchen garden vegetables (Karachi winter)' },
  { name: 'Tomato', botanicalName: '', category: 'vegetable', careProfileName: 'Kitchen garden vegetables (Karachi winter)' },
  { name: 'Okra', botanicalName: '', category: 'vegetable', careProfileName: 'Kitchen garden vegetables (Karachi winter)' },
  { name: 'Cucumber', botanicalName: '', category: 'vegetable', careProfileName: 'Kitchen garden vegetables (Karachi winter)' },
  { name: 'Peas', botanicalName: '', category: 'vegetable', careProfileName: 'Kitchen garden vegetables (Karachi winter)' },
  { name: 'Bitter Gourd', botanicalName: '', category: 'vegetable', careProfileName: 'Kitchen garden vegetables (Karachi winter)' },
  { name: 'Apple Gourd', botanicalName: '', category: 'vegetable', careProfileName: 'Kitchen garden vegetables (Karachi winter)' },
  { name: 'Vegetable Seedlings (tray)', botanicalName: '', category: 'seedling', careProfileName: 'Kitchen garden vegetables (Karachi winter)' },
];

/**
 * One-time category corrections for gardens seeded before the richer
 * category taxonomy existed. Applied by services/gardenSeedService.js only
 * to plants whose category still equals `from` (so a plant the user has
 * already recategorized is never touched). Fresh installs skip these
 * naturally — their plants are seeded at the `to` value already.
 */
export const CATEGORY_FIXUPS = Object.freeze([
  { name: 'Bougainvillea', from: 'flower', to: 'climber' },
  { name: 'Rose', from: 'flower', to: 'shrub' },
  { name: 'Jasmine', from: 'flower', to: 'climber' },
  { name: 'Motia', from: 'flower', to: 'shrub' },
  { name: 'Boston Fern', from: 'indoor', to: 'foliage' },
  { name: 'Lady Palm', from: 'indoor', to: 'foliage' },
  { name: 'Areca Palm', from: 'indoor', to: 'foliage' },
  { name: 'Malaysian Palm', from: 'indoor', to: 'foliage' },
  { name: 'Snake Plant', from: 'indoor', to: 'succulent' },
  { name: 'Money Plant', from: 'indoor', to: 'climber' },
  { name: 'Rubber Plant', from: 'indoor', to: 'foliage' },
  { name: 'African Hosta', from: 'indoor', to: 'foliage' },
  { name: 'Dieffenbachia', from: 'indoor', to: 'foliage' },
  { name: 'Dracaena', from: 'indoor', to: 'foliage' },
  { name: 'Song of India', from: 'indoor', to: 'foliage' },
]);

/**
 * Photo-audit category corrections (Sprint S-14, owner-confirmed 2026-07-15).
 *
 * CATEGORY_FIXUPS above matches the original seed names only, so plants the
 * owner renamed ("Bougainvillea" → "Bougainvillea 1 White") kept their old
 * category. These entries are keyed by the owner's *current* names, taken
 * from the 2026-07-13 backup. Applied by services/gardenSeedService.js under
 * the AD-009 guard: a plant changes only while its category still equals
 * `from`, so any category the owner has since chosen themselves is preserved.
 *
 * Owner decisions recorded for this set: the two low-confidence IDs
 * ("Bamboo Palm" — looks like a Dracaena cane rather than a Chamaedorea;
 * "Copperleaf") keep their names — category only, no renames.
 */
export const PHOTO_AUDIT_CATEGORY_FIXUPS = Object.freeze([
  { name: 'Bougainvillea 1 White', from: 'flower', to: 'climber' },
  { name: 'Bougainvillea 2 Orange', from: 'flower', to: 'climber' },
  { name: 'Bougainvillea 3 Red', from: 'flower', to: 'climber' },
  { name: 'Bougainvillea 4 Pink', from: 'flower', to: 'climber' },
  { name: 'Money Plant 1', from: 'indoor', to: 'climber' },
  { name: 'Motia 1', from: 'flower', to: 'shrub' },
  { name: 'Motia 2', from: 'flower', to: 'shrub' },
  { name: 'Rose Pink', from: 'flower', to: 'shrub' },
  { name: 'Rose Red 1', from: 'flower', to: 'shrub' },
  { name: 'Hibiscus / Gudhal', from: 'flower', to: 'shrub' },
  { name: 'Copperleaf', from: 'outdoor', to: 'shrub' },
  { name: 'Snake Plant 1', from: 'indoor', to: 'succulent' },
  { name: 'Snake Plant 2', from: 'indoor', to: 'succulent' },
  { name: 'Snake Plant 3', from: 'indoor', to: 'succulent' },
  { name: 'Boston Fern 1', from: 'indoor', to: 'foliage' },
  { name: 'Boston Fern 2', from: 'indoor', to: 'foliage' },
  { name: 'Rubber Plant 1', from: 'indoor', to: 'foliage' },
  { name: 'Rubber Plant 2', from: 'indoor', to: 'foliage' },
  { name: 'Malaysian Palm 1', from: 'indoor', to: 'foliage' },
  { name: 'Bamboo Palm', from: 'indoor', to: 'foliage' },
  { name: 'Coleus', from: 'outdoor', to: 'foliage' },
  { name: 'Umbrella Plant', from: 'outdoor', to: 'foliage' },
]);

/**
 * Photo-audit botanical-name corrections (Sprint S-14). Applied only when the
 * field is still empty, so an owner-entered name is never overwritten.
 */
export const PHOTO_AUDIT_BOTANICAL_FIXUPS = Object.freeze([
  { name: 'Rose Pink', botanicalName: 'Rosa indica' },
]);
