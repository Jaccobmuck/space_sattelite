import { describe, it, expect } from 'vitest';
import { SATELLITE_TYPE_COLORS } from '../globe';
import { SATELLITE_TYPES } from '../../types/satellite';

describe('SATELLITE_TYPE_COLORS', () => {
  it('has an entry for every SatelliteType', () => {
    for (const type of SATELLITE_TYPES) {
      expect(
        Object.prototype.hasOwnProperty.call(SATELLITE_TYPE_COLORS, type),
        `Missing color for type "${type}"`,
      ).toBe(true);
    }
  });

  it('all values are valid hex color numbers (> 0, <= 0xffffff)', () => {
    for (const [type, color] of Object.entries(SATELLITE_TYPE_COLORS)) {
      const num = color as number;
      expect(typeof num, `${type} color should be a number`).toBe('number');
      expect(num, `${type} color should be >= 0`).toBeGreaterThanOrEqual(0);
      expect(num, `${type} color should be <= 0xffffff`).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('has exactly as many entries as SATELLITE_TYPES', () => {
    expect(Object.keys(SATELLITE_TYPE_COLORS).length).toBe(SATELLITE_TYPES.length);
  });

  it('key set matches SATELLITE_TYPES exactly', () => {
    const colorKeys = Object.keys(SATELLITE_TYPE_COLORS).sort();
    const typeKeys  = [...SATELLITE_TYPES].sort();
    expect(colorKeys).toEqual(typeKeys);
  });
});
