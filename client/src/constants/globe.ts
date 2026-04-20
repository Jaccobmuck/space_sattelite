import type { SatelliteType } from '../types/satellite';
import type { ColorRepresentation } from 'three';

// ─── Scene scale ─────────────────────────────────────────────────────────────
/** Earth radius in Three.js world units */
export const EARTH_RADIUS = 1;

/** Radius of the star / constellation sphere (must be >> globe) */
export const STAR_SPHERE_RADIUS = 500;

/** Moon distance from Earth centre in world units */
export const MOON_ORBIT_RADIUS = EARTH_RADIUS * 3;

/** Moon visual radius in world units */
export const MOON_RADIUS = 0.27;

// ─── Satellite rendering ──────────────────────────────────────────────────────
/** Maximum satellites stored per InstancedMesh type */
export const MAX_SATELLITES_PER_TYPE = 5000;

/** Uniform scale multiplier applied to the selected satellite's instance matrix */
export const SELECTED_SATELLITE_SCALE = 1.4;

/** Altitude-to-scene-unit divisor (Earth radius in km) */
export const EARTH_RADIUS_KM = 6371;

// ─── Star / DSO filtering ─────────────────────────────────────────────────────
/** Default naked-eye magnitude cut-off */
export const STAR_MAGNITUDE_THRESHOLD = 6.5;

/** Pro-tier magnitude cut-off (toggle) */
export const STAR_MAGNITUDE_PRO_THRESHOLD = 9.0;

/** Maximum magnitude shown for deep-sky objects */
export const DSO_VISIBILITY_MAG_THRESHOLD = 10;

// ─── Colors ───────────────────────────────────────────────────────────────────
export const SATELLITE_TYPE_COLORS: Record<SatelliteType, ColorRepresentation> = {
  comms:      0x3b82f6,  // blue
  imagery:    0xef4444,  // red
  weather:    0x22d3ee,  // cyan
  nav:        0x22c55e,  // green
  crewed:     0xeab308,  // gold
  debris:     0x6b7280,  // gray
  scientific: 0xa855f7,  // purple
  unknown:    0xffffff,  // white
};
