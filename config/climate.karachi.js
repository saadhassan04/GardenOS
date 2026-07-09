/**
 * Karachi climate profile (Platform layer, L1) — PROJECT_REQUIREMENTS.md §1.2.
 * Drives seasonal care logic today and weather-alert thresholds in v2.5.
 * Data, not code: adjusting the garden's climate = editing this file.
 */

export const KARACHI_COORDS = Object.freeze({ latitude: 24.8607, longitude: 67.0011 });

/**
 * Care seasons by calendar month (1–12). Karachi reality:
 * long hot summer, a wet monsoon quarter, and a mild dry "winter"
 * (which is the main kitchen-garden growing season).
 */
export const CARE_SEASONS = Object.freeze({
  summer: [3, 4, 5, 6],    // Mar–Jun: heat builds to 40°C+, heat-wave risk
  monsoon: [7, 8, 9],      // Jul–Sep: humid, heavy rain events, fungal risk
  winter: [10, 11, 12, 1, 2], // Oct–Feb: mild, dry, prime growing season
});

/** Weather-alert thresholds (consumed by v2.5 Weather Intelligence). */
export const ALERT_THRESHOLDS = Object.freeze({
  heatWaveTempC: 40,
  heavyRainMmPerDay: 50,
  highHumidityPct: 85,
});

/**
 * @param {Date} [date]
 * @returns {'summer'|'monsoon'|'winter'}
 */
export function currentSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  for (const [season, months] of Object.entries(CARE_SEASONS)) {
    if (months.includes(month)) {
      return season;
    }
  }
  return 'winter';
}
