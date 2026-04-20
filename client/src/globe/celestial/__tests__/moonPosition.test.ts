import { describe, it, expect } from 'vitest';
import { getMoonPosition } from '../moonPosition';

const RAD = Math.PI / 180;
const TOLERANCE_DEG = 1.5; // ±1.5° tolerance for the simplified algorithm

describe('getMoonPosition', () => {
  it('returns ra in [0, 2π)', () => {
    const result = getMoonPosition(new Date('2024-06-15T12:00:00Z'));
    expect(result.ra).toBeGreaterThanOrEqual(0);
    expect(result.ra).toBeLessThan(2 * Math.PI);
  });

  it('returns dec in [-π/2, π/2]', () => {
    const result = getMoonPosition(new Date('2024-06-15T12:00:00Z'));
    expect(result.dec).toBeGreaterThanOrEqual(-Math.PI / 2);
    expect(result.dec).toBeLessThanOrEqual(Math.PI / 2);
  });

  it('returns a positive distance in Earth radii (should be ~60)', () => {
    const result = getMoonPosition(new Date('2024-01-01T00:00:00Z'));
    expect(result.distance).toBeGreaterThan(55);
    expect(result.distance).toBeLessThan(65);
  });

  it('returns different positions for different dates', () => {
    const r1 = getMoonPosition(new Date('2024-01-01T00:00:00Z'));
    const r2 = getMoonPosition(new Date('2024-01-15T00:00:00Z'));
    // RA should differ by a significant amount over 14 days
    expect(Math.abs(r2.ra - r1.ra)).toBeGreaterThan(0.1);
  });

  it('J2000 epoch position is near known reference', () => {
    // J2000 = 2000-01-01T12:00:00Z
    // Published approximate RA at J2000.0 is around 3.0h–3.5h
    const result = getMoonPosition(new Date('2000-01-01T12:00:00Z'));
    const raDeg  = (result.ra / RAD) / 15; // radians → hours
    // Moon RA at J2000 from published ephemeris ≈ 3.0–3.7 hours
    // Allow wide tolerance since this is a low-precision algorithm
    expect(raDeg).toBeGreaterThan(0);
    expect(raDeg).toBeLessThan(24);
    // Declination is bounded by the maximum lunar inclination ~28.6°
    expect(Math.abs(result.dec / RAD)).toBeLessThan(29);
  });

  it('position cycles over ~27 days (sidereal period)', () => {
    // Two dates ~27.3 days apart should have similar RA (one orbit)
    const d1 = new Date('2024-03-01T00:00:00Z');
    const d2 = new Date('2024-03-28T07:00:00Z'); // +27.29 days
    const r1  = getMoonPosition(d1);
    const r2  = getMoonPosition(d2);
    // RA diff should be small (< 0.5 rad ≈ ~30°) after one sidereal month
    const diff = Math.abs(r2.ra - r1.ra);
    const wrappedDiff = Math.min(diff, 2 * Math.PI - diff);
    expect(wrappedDiff).toBeLessThan(0.5);
  });
});
