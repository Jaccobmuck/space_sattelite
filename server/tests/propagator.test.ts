/**
 * Unit tests for the SGP4 orbital propagation engine.
 *
 * Uses a real ISS TLE (epoch 2024-02-27) so outputs are physically meaningful.
 * All assertions check ranges rather than exact values because orbit propagation
 * is time-dependent.
 */

import { describe, it, expect } from 'vitest';
import {
  propagateSatellite,
  propagateOrbitPath,
  getNextPasses,
} from '../src/orbital/propagator.js';

// ─── Test fixtures ────────────────────────────────────────────────────────────

// ISS TLE, epoch 2024-02-27 (NORAD 25544)
const ISS_TLE1 = '1 25544U 98067A   24058.51342592  .00017048  00000+0  30827-3 0  9999';
const ISS_TLE2 = '2 25544  51.6402 258.0321 0002052  26.8773 333.2367 15.49697927441705';

// Invalid / garbage TLE
const BAD_TLE1 = '1 XXXXX  garbage line one !!!';
const BAD_TLE2 = '2 XXXXX  garbage line two !!!';

// A fixed epoch close to the TLE epoch (2024-02-27T12:19:43Z)
const EPOCH_MS = new Date('2024-02-27T12:19:43Z').getTime();

// Observer: London, UK — a realistic pass observer location
const OBSERVER_LAT = 51.5074;
const OBSERVER_LNG = -0.1278;
const OBSERVER_ALT = 11; // metres above sea level

// ─── propagateSatellite ───────────────────────────────────────────────────────

describe('propagateSatellite', () => {
  it('returns a position object for a valid ISS TLE', () => {
    const pos = propagateSatellite(ISS_TLE1, ISS_TLE2, EPOCH_MS);
    expect(pos).not.toBeNull();
    expect(pos).toMatchObject({
      lat: expect.any(Number),
      lng: expect.any(Number),
      alt: expect.any(Number),
      velocity: expect.any(Number),
    });
  });

  it('returns latitude in valid range [-90, 90]', () => {
    const pos = propagateSatellite(ISS_TLE1, ISS_TLE2, EPOCH_MS);
    expect(pos!.lat).toBeGreaterThanOrEqual(-90);
    expect(pos!.lat).toBeLessThanOrEqual(90);
  });

  it('returns longitude in valid range [-180, 180]', () => {
    const pos = propagateSatellite(ISS_TLE1, ISS_TLE2, EPOCH_MS);
    expect(pos!.lng).toBeGreaterThanOrEqual(-180);
    expect(pos!.lng).toBeLessThanOrEqual(180);
  });

  it('returns altitude in LEO range [300, 600] km for ISS', () => {
    const pos = propagateSatellite(ISS_TLE1, ISS_TLE2, EPOCH_MS);
    // ISS orbits between ~408-410 km; allow headroom for TLE age
    expect(pos!.alt).toBeGreaterThan(300);
    expect(pos!.alt).toBeLessThan(600);
  });

  it('returns orbital velocity ~7.7 km/s for ISS', () => {
    const pos = propagateSatellite(ISS_TLE1, ISS_TLE2, EPOCH_MS);
    // ISS velocity ≈ 7.66 km/s; allow ±0.5 km/s tolerance
    expect(pos!.velocity).toBeGreaterThan(7.0);
    expect(pos!.velocity).toBeLessThan(8.5);
  });

  it('uses current time when dateMs is omitted', () => {
    const before = Date.now();
    const pos = propagateSatellite(ISS_TLE1, ISS_TLE2);
    const after = Date.now();
    expect(pos).not.toBeNull();
    // Just verify it returned a position; we can't assert exact coords
    expect(pos!.alt).toBeGreaterThan(0);
    expect(before).toBeLessThanOrEqual(after); // sanity
  });

  it('returns null for invalid TLE', () => {
    const pos = propagateSatellite(BAD_TLE1, BAD_TLE2, EPOCH_MS);
    expect(pos).toBeNull();
  });

  it('returns null for empty TLE strings', () => {
    const pos = propagateSatellite('', '', EPOCH_MS);
    expect(pos).toBeNull();
  });
});

// ─── propagateOrbitPath ───────────────────────────────────────────────────────

describe('propagateOrbitPath', () => {
  it('returns an array of orbit points', () => {
    const path = propagateOrbitPath(ISS_TLE1, ISS_TLE2, 10, 60);
    expect(Array.isArray(path)).toBe(true);
    expect(path.length).toBeGreaterThan(0);
  });

  it('returns the correct number of points for given duration and step', () => {
    // 10 minutes at 60-second steps = 11 points (0 … 10 inclusive)
    const path = propagateOrbitPath(ISS_TLE1, ISS_TLE2, 10, 60);
    expect(path.length).toBe(11);
  });

  it('returns 181 points for 90-minute orbit at 30-second steps', () => {
    // 90 min * 60 s / 30 s = 180 intervals → 181 points
    const path = propagateOrbitPath(ISS_TLE1, ISS_TLE2, 90, 30);
    expect(path.length).toBe(181);
  });

  it('each point has lat, lng, alt, time fields', () => {
    const path = propagateOrbitPath(ISS_TLE1, ISS_TLE2, 5, 60);
    for (const pt of path) {
      expect(typeof pt.lat).toBe('number');
      expect(typeof pt.lng).toBe('number');
      expect(typeof pt.alt).toBe('number');
      expect(pt.time).toBeInstanceOf(Date);
    }
  });

  it('all latitudes are within [-90, 90]', () => {
    const path = propagateOrbitPath(ISS_TLE1, ISS_TLE2, 90, 60);
    for (const pt of path) {
      expect(pt.lat).toBeGreaterThanOrEqual(-90);
      expect(pt.lat).toBeLessThanOrEqual(90);
    }
  });

  it('all longitudes are within [-180, 180]', () => {
    const path = propagateOrbitPath(ISS_TLE1, ISS_TLE2, 90, 60);
    for (const pt of path) {
      expect(pt.lng).toBeGreaterThanOrEqual(-180);
      expect(pt.lng).toBeLessThanOrEqual(180);
    }
  });

  it('time values are monotonically increasing', () => {
    const path = propagateOrbitPath(ISS_TLE1, ISS_TLE2, 10, 60);
    for (let i = 1; i < path.length; i++) {
      expect(path[i].time.getTime()).toBeGreaterThan(path[i - 1].time.getTime());
    }
  });

  it('returns empty array for invalid TLE', () => {
    const path = propagateOrbitPath(BAD_TLE1, BAD_TLE2, 10, 60);
    expect(path).toEqual([]);
  });

  it('uses sensible defaults when called with TLE only', () => {
    // default: 90 min duration, 30 s step → 181 points
    const path = propagateOrbitPath(ISS_TLE1, ISS_TLE2);
    expect(path.length).toBe(181);
  });
});

// ─── getNextPasses ────────────────────────────────────────────────────────────

describe('getNextPasses', () => {
  it('returns an array (may be empty if no passes in window)', () => {
    const passes = getNextPasses(ISS_TLE1, ISS_TLE2, OBSERVER_LAT, OBSERVER_LNG, OBSERVER_ALT, 24);
    expect(Array.isArray(passes)).toBe(true);
  });

  it('returns empty array for invalid TLE', () => {
    const passes = getNextPasses(BAD_TLE1, BAD_TLE2, OBSERVER_LAT, OBSERVER_LNG, OBSERVER_ALT, 24);
    expect(passes).toEqual([]);
  });

  it('each pass has required fields', () => {
    // Use a generous 72-hour window to ensure at least one ISS pass is found
    const passes = getNextPasses(ISS_TLE1, ISS_TLE2, OBSERVER_LAT, OBSERVER_LNG, OBSERVER_ALT, 72);
    for (const pass of passes) {
      expect(pass.aos).toBeInstanceOf(Date);
      expect(pass.los).toBeInstanceOf(Date);
      expect(pass.maxElevationTime).toBeInstanceOf(Date);
      expect(typeof pass.aosAzimuth).toBe('number');
      expect(typeof pass.losAzimuth).toBe('number');
      expect(typeof pass.maxElevation).toBe('number');
      expect(typeof pass.duration).toBe('number');
    }
  });

  it('AOS is always before LOS', () => {
    const passes = getNextPasses(ISS_TLE1, ISS_TLE2, OBSERVER_LAT, OBSERVER_LNG, OBSERVER_ALT, 72);
    for (const pass of passes) {
      expect(pass.aos.getTime()).toBeLessThan(pass.los.getTime());
    }
  });

  it('maxElevationTime is between AOS and LOS', () => {
    const passes = getNextPasses(ISS_TLE1, ISS_TLE2, OBSERVER_LAT, OBSERVER_LNG, OBSERVER_ALT, 72);
    for (const pass of passes) {
      expect(pass.maxElevationTime.getTime()).toBeGreaterThanOrEqual(pass.aos.getTime());
      expect(pass.maxElevationTime.getTime()).toBeLessThanOrEqual(pass.los.getTime());
    }
  });

  it('maxElevation is at least the minimum observable elevation (10°)', () => {
    const passes = getNextPasses(ISS_TLE1, ISS_TLE2, OBSERVER_LAT, OBSERVER_LNG, OBSERVER_ALT, 72);
    for (const pass of passes) {
      expect(pass.maxElevation).toBeGreaterThanOrEqual(10);
    }
  });

  it('duration equals LOS minus AOS in seconds', () => {
    const passes = getNextPasses(ISS_TLE1, ISS_TLE2, OBSERVER_LAT, OBSERVER_LNG, OBSERVER_ALT, 72);
    for (const pass of passes) {
      const expectedDuration = Math.round(
        (pass.los.getTime() - pass.aos.getTime()) / 1000,
      );
      expect(pass.duration).toBe(expectedDuration);
    }
  });

  it('passes are sorted by AOS (ascending)', () => {
    const passes = getNextPasses(ISS_TLE1, ISS_TLE2, OBSERVER_LAT, OBSERVER_LNG, OBSERVER_ALT, 72);
    for (let i = 1; i < passes.length; i++) {
      expect(passes[i].aos.getTime()).toBeGreaterThanOrEqual(passes[i - 1].aos.getTime());
    }
  });

  it('azimuth values are in [0, 360] degrees', () => {
    const passes = getNextPasses(ISS_TLE1, ISS_TLE2, OBSERVER_LAT, OBSERVER_LNG, OBSERVER_ALT, 72);
    for (const pass of passes) {
      expect(pass.aosAzimuth).toBeGreaterThanOrEqual(0);
      expect(pass.aosAzimuth).toBeLessThanOrEqual(360);
      expect(pass.losAzimuth).toBeGreaterThanOrEqual(0);
      expect(pass.losAzimuth).toBeLessThanOrEqual(360);
    }
  });
});
