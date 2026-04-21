/**
 * SGP4/SDP4 orbital propagation engine for SENTRY.
 *
 * Wraps the satellite.js library to expose three clean functions:
 *   propagateSatellite  — single position at a given epoch
 *   propagateOrbitPath  — ground-track array over a time window
 *   getNextPasses       — AOS/LOS/max-elevation pass windows
 *
 * All functions return null / [] on invalid TLE or propagation error;
 * they never throw.  Callers should treat null as "data unavailable".
 */

import * as satellite from 'satellite.js';

const DEG = 180 / Math.PI;
const MIN_ELEVATION_DEG = 10; // minimum observable elevation (degrees)
const PASS_STEP_SECONDS = 10; // sampling interval for pass detection

// ─────────────────────────────────────────────────────────────────────────────

export interface SatellitePosition {
  lat: number;
  lng: number;
  alt: number;       // km above WGS-84 ellipsoid
  velocity: number;  // km/s
}

export interface OrbitPoint {
  lat: number;
  lng: number;
  alt: number;
  time: Date;
}

export interface PassWindow {
  /** Acquisition of Signal */
  aos: Date;
  aosAzimuth: number;        // degrees
  /** Loss of Signal */
  los: Date;
  losAzimuth: number;        // degrees
  /** Moment of maximum elevation */
  maxElevationTime: Date;
  maxElevation: number;      // degrees
  duration: number;          // seconds
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseSatrec(tle1: string, tle2: string): satellite.SatRec | null {
  try {
    const satrec = satellite.twoline2satrec(tle1.trim(), tle2.trim());
    return satrec.error === 0 ? satrec : null;
  } catch {
    return null;
  }
}

function propagateAt(
  satrec: satellite.SatRec,
  date: Date,
): { positionEci: satellite.EciVec3<number>; velocityEci: satellite.EciVec3<number> } | null {
  try {
    const pv = satellite.propagate(satrec, date);
    if (typeof pv.position === 'boolean' || typeof pv.velocity === 'boolean') {
      return null;
    }
    return { positionEci: pv.position as satellite.EciVec3<number>, velocityEci: pv.velocity as satellite.EciVec3<number> };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute satellite position at a specific UTC epoch.
 *
 * @param tle1   TLE line 1
 * @param tle2   TLE line 2
 * @param dateMs UTC timestamp in milliseconds (Date.now() by default)
 * @returns geodetic position + velocity, or null on error
 */
export function propagateSatellite(
  tle1: string,
  tle2: string,
  dateMs: number = Date.now(),
): SatellitePosition | null {
  try {
    const satrec = parseSatrec(tle1, tle2);
    if (!satrec) return null;

    const date = new Date(dateMs);
    const pv = propagateAt(satrec, date);
    if (!pv) return null;

    const gmst = satellite.gstime(date);
    const posGd = satellite.eciToGeodetic(pv.positionEci, gmst);

    const lat = satellite.degreesLat(posGd.latitude);
    const lng = satellite.degreesLong(posGd.longitude);
    const alt = posGd.height;
    const velocity = Math.sqrt(
      pv.velocityEci.x ** 2 + pv.velocityEci.y ** 2 + pv.velocityEci.z ** 2,
    );

    return { lat, lng, alt, velocity };
  } catch (err) {
    console.error('[propagator] propagateSatellite error:', err);
    return null;
  }
}

/**
 * Generate a ground-track array over a sliding time window.
 *
 * @param tle1            TLE line 1
 * @param tle2            TLE line 2
 * @param durationMinutes window length in minutes (default 90)
 * @param stepSeconds     sample interval in seconds (default 30)
 * @returns ordered array of geodetic points (may be empty on TLE error)
 */
export function propagateOrbitPath(
  tle1: string,
  tle2: string,
  durationMinutes: number = 90,
  stepSeconds: number = 30,
): OrbitPoint[] {
  try {
    const satrec = parseSatrec(tle1, tle2);
    if (!satrec) return [];

    const points: OrbitPoint[] = [];
    const now = Date.now();
    const totalSteps = Math.round((durationMinutes * 60) / stepSeconds);

    for (let i = 0; i <= totalSteps; i++) {
      const date = new Date(now + i * stepSeconds * 1000);
      const pv = propagateAt(satrec, date);
      if (!pv) continue;

      const gmst = satellite.gstime(date);
      const posGd = satellite.eciToGeodetic(pv.positionEci, gmst);

      points.push({
        lat: satellite.degreesLat(posGd.latitude),
        lng: satellite.degreesLong(posGd.longitude),
        alt: posGd.height,
        time: date,
      });
    }

    return points;
  } catch (err) {
    console.error('[propagator] propagateOrbitPath error:', err);
    return [];
  }
}

/**
 * Find visible pass windows from an observer location.
 *
 * Samples the orbit at PASS_STEP_SECONDS intervals and identifies continuous
 * windows where the satellite is above MIN_ELEVATION_DEG.
 *
 * @param tle1          TLE line 1
 * @param tle2          TLE line 2
 * @param observerLat   observer geodetic latitude  (degrees)
 * @param observerLng   observer geodetic longitude (degrees)
 * @param observerAlt   observer altitude above sea level (metres)
 * @param hoursAhead    search horizon in hours (default 24)
 * @returns array of pass windows sorted by AOS (may be empty)
 */
export function getNextPasses(
  tle1: string,
  tle2: string,
  observerLat: number,
  observerLng: number,
  observerAlt: number = 0,
  hoursAhead: number = 24,
): PassWindow[] {
  try {
    const satrec = parseSatrec(tle1, tle2);
    if (!satrec) return [];

    const observerGd: satellite.GeodeticLocation = {
      longitude: observerLng / DEG,
      latitude: observerLat / DEG,
      height: observerAlt / 1000, // metres → km
    };

    const passes: PassWindow[] = [];
    const now = Date.now();
    const totalSeconds = hoursAhead * 3600;
    const totalSteps = Math.round(totalSeconds / PASS_STEP_SECONDS);

    // Pass accumulator
    let inPass = false;
    let aosTime: Date | null = null;
    let aosAzDeg = 0;
    let losTime: Date | null = null;
    let losAzDeg = 0;
    let maxElDeg = 0;
    let maxElTime: Date | null = null;

    const finalisePass = (currentDate: Date, azDeg: number) => {
      losTime = currentDate;
      losAzDeg = azDeg;
      if (aosTime && maxElTime && losTime) {
        passes.push({
          aos: aosTime,
          aosAzimuth: aosAzDeg,
          los: losTime,
          losAzimuth: losAzDeg,
          maxElevationTime: maxElTime,
          maxElevation: maxElDeg,
          duration: Math.round((losTime.getTime() - aosTime.getTime()) / 1000),
        });
      }
      inPass = false;
      aosTime = null;
      maxElDeg = 0;
      maxElTime = null;
    };

    for (let i = 0; i <= totalSteps; i++) {
      const date = new Date(now + i * PASS_STEP_SECONDS * 1000);
      const pv = propagateAt(satrec, date);
      if (!pv) continue;

      const gmst = satellite.gstime(date);
      const posEcf = satellite.eciToEcf(pv.positionEci, gmst);
      const look = satellite.ecfToLookAngles(observerGd, posEcf);
      const elDeg = look.elevation * DEG;
      const azDeg = look.azimuth * DEG;

      if (elDeg >= MIN_ELEVATION_DEG) {
        if (!inPass) {
          inPass = true;
          aosTime = date;
          aosAzDeg = azDeg;
          maxElDeg = elDeg;
          maxElTime = date;
        } else if (elDeg > maxElDeg) {
          maxElDeg = elDeg;
          maxElTime = date;
        }
      } else {
        if (inPass) {
          finalisePass(date, azDeg);
        }
      }
    }

    // Close an open pass at the end of the search window
    if (inPass && aosTime && maxElTime) {
      const endDate = new Date(now + totalSeconds * 1000);
      finalisePass(endDate, 0);
    }

    return passes;
  } catch (err) {
    console.error('[propagator] getNextPasses error:', err);
    return [];
  }
}
