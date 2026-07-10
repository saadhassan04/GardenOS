/**
 * Karachi sowing calendar seed data (Data layer, L2) — FR-5.4, T-063.
 * Months are calendar months (1–12) when sowing works in Karachi's
 * climate: the mild Oct–Feb "winter" is the main growing season; okra,
 * gourds, and chilies own the heat. User-added crops live in appMeta and
 * merge with this list (services/sowingCalendarService.js).
 */

export const KARACHI_SOWING_CALENDAR = [
  { crop: 'Tomato', months: [9, 10, 11], notes: 'Sow in trays; transplant at 4–5 true leaves' },
  { crop: 'Spinach', months: [9, 10, 11, 12, 1], notes: 'Successive sowings every 3 weeks' },
  { crop: 'Broccoli', months: [9, 10], notes: 'Needs the coolest months to head well' },
  { crop: 'Cauliflower', months: [9, 10], notes: '' },
  { crop: 'Peas', months: [10, 11], notes: 'Direct sow; give support early' },
  { crop: 'Carrot', months: [10, 11, 12], notes: 'Direct sow in deep, loose soil' },
  { crop: 'Radish', months: [9, 10, 11, 12, 1], notes: 'Fast — ready in ~30 days' },
  { crop: 'Lettuce', months: [10, 11, 12], notes: 'Part shade extends the season' },
  { crop: 'Coriander', months: [9, 10, 11, 12, 1, 2], notes: 'Bolts fast once heat returns' },
  { crop: 'Onion', months: [10, 11], notes: 'From seed or sets' },
  { crop: 'Garlic', months: [10, 11], notes: 'Plant cloves pointy-end up' },
  { crop: 'Okra', months: [2, 3, 4, 6, 7], notes: 'Loves heat; soak seed overnight' },
  { crop: 'Green chili', months: [2, 3, 7], notes: 'Trays, then transplant' },
  { crop: 'Bell pepper', months: [2, 3], notes: 'Slow starter — be patient' },
  { crop: 'Eggplant', months: [2, 3, 6, 7], notes: 'Handles Karachi summer well' },
  { crop: 'Cucumber', months: [2, 3, 6], notes: 'Direct sow; climbs happily' },
  { crop: 'Bitter gourd', months: [2, 3, 6, 7], notes: 'Monsoon sowings thrive' },
  { crop: 'Apple gourd', months: [2, 3, 6], notes: 'Tinda — direct sow on mounds' },
  { crop: 'Mint', months: [2, 3, 9, 10], notes: 'From runners, not seed' },
];
