/**
 * Feature flags (Platform layer, L1) — ARCHITECTURE.md D8.
 * Every future capability ships dark behind a flag; roadmap versions flip
 * flags, not architecture. Flags are code-defined; a per-device override can
 * be set from the (future) Diagnostics view for testing.
 */

const FLAGS = Object.freeze({
  aiVision: false,       // v2.0
  weather: false,        // v2.5
  gardenAi: false,       // v3.0
  cloudSync: false,      // v4.0
  sensors: false,        // v5.0
  digitalTwin: false,    // v6.0
});

const OVERRIDE_KEY = 'gardenos.flags.v1';

/**
 * Whether a feature flag is enabled on this device.
 * @param {keyof typeof FLAGS} name
 * @returns {boolean}
 */
export function isEnabled(name) {
  if (!(name in FLAGS)) {
    return false;
  }
  try {
    const overrides = JSON.parse(window.localStorage.getItem(OVERRIDE_KEY)) || {};
    if (typeof overrides[name] === 'boolean') {
      return overrides[name];
    }
  } catch {
    // Corrupt overrides are ignored; code-defined defaults win.
  }
  return FLAGS[name];
}

/** @returns {Readonly<Record<string, boolean>>} effective flag map (for Diagnostics). */
export function allFlags() {
  const effective = {};
  for (const name of Object.keys(FLAGS)) {
    effective[name] = isEnabled(name);
  }
  return Object.freeze(effective);
}
