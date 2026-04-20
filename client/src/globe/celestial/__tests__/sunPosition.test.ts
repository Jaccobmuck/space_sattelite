import { describe, it, expect } from 'vitest';
import { getSunPosition, sunPositionToDirection } from '../sunPosition';

const DEG = Math.PI / 180;
const TOLERANCE_DEG = 0.6; // ±0.6° – USNO algorithm is accurate to ~1°

describe('getSunPosition', () => {
  it('returns ra in [0, 2π)', () => {
    const r = getSunPosition(new Date('2024-06-21T12:00:00Z'));
    expect(r.ra).toBeGreaterThanOrEqual(0);
    expect(r.ra).toBeLessThan(2 * Math.PI);
  });

  it('returns dec in [-π/2, π/2]', () => {
    const r = getSunPosition(new Date('2024-06-21T12:00:00Z'));
    expect(r.dec).toBeGreaterThanOrEqual(-Math.PI / 2);
    expect(r.dec).toBeLessThanOrEqual(Math.PI / 2);
  });

  it('summer solstice declination ≈ +23.4° (±0.5°)', () => {
    // 2024-06-21T12:00:00Z is near northern summer solstice
    const r       = getSunPosition(new Date('2024-06-21T12:00:00Z'));
    const decDeg  = r.dec / DEG;
    expect(decDeg).toBeGreaterThan(23.4 - 0.5);
    expect(decDeg).toBeLessThan(23.4 + 0.5);
  });

  it('March equinox declination ≈ 0° (±0.5°)', () => {
    // 2024-03-20 is the spring equinox
    const r      = getSunPosition(new Date('2024-03-20T12:00:00Z'));
    const decDeg = r.dec / DEG;
    expect(Math.abs(decDeg)).toBeLessThan(0.5);
  });

  it('winter solstice declination ≈ -23.4° (±0.5°)', () => {
    const r      = getSunPosition(new Date('2024-12-21T12:00:00Z'));
    const decDeg = r.dec / DEG;
    expect(decDeg).toBeLessThan(-23.4 + 0.5);
    expect(decDeg).toBeGreaterThan(-23.4 - 0.5);
  });

  it('returns different positions for different dates', () => {
    const r1 = getSunPosition(new Date('2024-01-01T00:00:00Z'));
    const r2 = getSunPosition(new Date('2024-07-01T00:00:00Z'));
    // RA should differ by ~π (6 months ≈ half orbit)
    const diff = Math.abs(r2.ra - r1.ra);
    expect(diff).toBeGreaterThan(2.5);
  });
});

describe('sunPositionToDirection', () => {
  it('produces a unit vector', () => {
    const pos = getSunPosition(new Date('2024-06-21T12:00:00Z'));
    const [x, y, z] = sunPositionToDirection(pos);
    const len = Math.sqrt(x * x + y * y + z * z);
    expect(len).toBeCloseTo(1.0, 5);
  });

  it('y-component is positive (northward) at summer solstice', () => {
    const pos = getSunPosition(new Date('2024-06-21T12:00:00Z'));
    const [, y] = sunPositionToDirection(pos);
    // At summer solstice, declination > 0 → sin(dec) > 0 → y > 0
    expect(y).toBeGreaterThan(0);
  });

  it('y-component is near zero at equinox', () => {
    const pos = getSunPosition(new Date('2024-03-20T12:00:00Z'));
    const [, y] = sunPositionToDirection(pos);
    expect(Math.abs(y)).toBeLessThan(0.01);
  });
});

describe('terminator shader logic (pure JS equivalent)', () => {
  // Test the smoothstep logic used by the day/night terminator shader
  function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function classifyPoint(dot: number): 'day' | 'twilight' | 'night' {
    const mix = smoothstep(-0.05, 0.05, dot);
    if (mix >= 0.95)      return 'day';
    if (mix <= 0.05)      return 'night';
    return 'twilight';
  }

  it('dot = +1.0 is day', () => {
    expect(classifyPoint(1.0)).toBe('day');
  });

  it('dot = +0.03 is twilight (within ±0.05 zone)', () => {
    expect(classifyPoint(0.03)).toBe('twilight');
  });

  it('dot = 0.0 is twilight (right on terminator)', () => {
    expect(classifyPoint(0.0)).toBe('twilight');
  });

  it('dot = -0.03 is twilight (within ±0.05 zone)', () => {
    expect(classifyPoint(-0.03)).toBe('twilight');
  });

  it('dot = -1.0 is night', () => {
    expect(classifyPoint(-1.0)).toBe('night');
  });

  it('smoothstep is monotonic between edges', () => {
    const values = [-0.1, -0.05, -0.03, 0.0, 0.03, 0.05, 0.1];
    const results = values.map(v => smoothstep(-0.05, 0.05, v));
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBeGreaterThanOrEqual(results[i - 1]);
    }
  });
});
