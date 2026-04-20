import { describe, it, expect } from 'vitest';
import { BufferGeometry } from 'three';
import { raDecToXYZ, magToSize, buildStarGeometry } from '../StarField';
import type { StarCatalogEntry } from '../StarField';
import { STAR_SPHERE_RADIUS } from '../../../constants/globe';

const FLOAT_TOLERANCE = 0.001;

describe('raDecToXYZ', () => {
  it('places Polaris near the north celestial pole (y ≈ radius)', () => {
    // Polaris: RA=2.53h, Dec=89.26°
    const [x, y, z] = raDecToXYZ(2.53, 89.26, STAR_SPHERE_RADIUS);
    // y should be close to STAR_SPHERE_RADIUS (almost exactly at north pole)
    expect(y / STAR_SPHERE_RADIUS).toBeGreaterThan(0.999);
    // x and z should be very small
    expect(Math.sqrt(x * x + z * z) / STAR_SPHERE_RADIUS).toBeLessThan(0.02);
  });

  it('places Sirius in the correct hemisphere (Dec ≈ -16.7°)', () => {
    // Sirius: RA=6.75h, Dec=-16.7°
    const [x, y, z] = raDecToXYZ(6.75, -16.7, STAR_SPHERE_RADIUS);
    // Dec < 0 → y should be negative
    expect(y).toBeLessThan(0);
    // Distance from origin should equal STAR_SPHERE_RADIUS
    const dist = Math.sqrt(x * x + y * y + z * z);
    expect(dist).toBeCloseTo(STAR_SPHERE_RADIUS, 0);
  });

  it('all output vectors lie on the sphere of radius STAR_SPHERE_RADIUS', () => {
    const testStars = [
      [0, 0], [12, 45], [18.6, 38.8], [5.9, 7.4], [14.3, -11.2],
    ] as [number, number][];

    for (const [ra, dec] of testStars) {
      const [x, y, z] = raDecToXYZ(ra, dec, STAR_SPHERE_RADIUS);
      const dist = Math.sqrt(x * x + y * y + z * z);
      expect(dist).toBeCloseTo(STAR_SPHERE_RADIUS, 1);
    }
  });

  it('RA=0, Dec=0 places star on the positive x-axis', () => {
    const [x, y, z] = raDecToXYZ(0, 0, STAR_SPHERE_RADIUS);
    expect(x).toBeCloseTo(STAR_SPHERE_RADIUS, 1);
    expect(Math.abs(y)).toBeLessThan(1);
    expect(Math.abs(z)).toBeLessThan(1);
  });

  it('RA=6h, Dec=0 places star on the positive z-axis (since ra = π/2)', () => {
    const [x, y, z] = raDecToXYZ(6, 0, STAR_SPHERE_RADIUS);
    expect(Math.abs(z)).toBeCloseTo(STAR_SPHERE_RADIUS, 0);
    expect(Math.abs(x)).toBeLessThan(1);
    expect(Math.abs(y)).toBeLessThan(1);
  });
});

describe('magToSize', () => {
  it('returns a positive size for all valid magnitudes', () => {
    for (const mag of [-1.5, 0, 1, 3, 5, 6.5]) {
      expect(magToSize(mag)).toBeGreaterThan(0);
    }
  });

  it('brighter stars (lower magnitude) get larger sizes', () => {
    const sizeSirius   = magToSize(-1.46);
    const sizePolaris  = magToSize(1.97);
    const sizeFaint    = magToSize(6.4);
    expect(sizeSirius).toBeGreaterThan(sizePolaris);
    expect(sizePolaris).toBeGreaterThan(sizeFaint);
  });
});

describe('buildStarGeometry', () => {
  const mockCatalog: StarCatalogEntry[] = [
    { ra: 6.75, dec: -16.72, mag: -1.46, name: 'Sirius'  },
    { ra: 2.53, dec:  89.26, mag:  1.97, name: 'Polaris' },
    { ra: 14.26, dec: 19.18, mag: -0.04, name: 'Arcturus' },
    { ra: 5.92, dec:   7.41, mag:  7.00  }, // above threshold
    { ra: 1.00, dec:  10.00, mag:  8.00  }, // above threshold
  ];

  it('returns a BufferGeometry', () => {
    const geom = buildStarGeometry(mockCatalog, 6.5);
    expect(geom).toBeInstanceOf(BufferGeometry);
    geom.dispose();
  });

  it('filters stars by magnitude threshold', () => {
    const geom  = buildStarGeometry(mockCatalog, 6.5);
    const count = geom.attributes.position.count;
    // Only 3 stars have mag <= 6.5
    expect(count).toBe(3);
    geom.dispose();
  });

  it('position attribute length equals filtered count × 3', () => {
    const threshold = 2.0;
    // stars with mag <= 2.0: Sirius (-1.46) and Arcturus (-0.04) and Polaris (1.97)
    const geom   = buildStarGeometry(mockCatalog, threshold);
    const attr   = geom.attributes.position;
    expect(attr.array.length).toBe(attr.count * 3);
    geom.dispose();
  });

  it('all stars included when threshold is very high', () => {
    const geom  = buildStarGeometry(mockCatalog, 99);
    expect(geom.attributes.position.count).toBe(mockCatalog.length);
    geom.dispose();
  });

  it('no stars included when threshold is very low', () => {
    const geom  = buildStarGeometry(mockCatalog, -5);
    expect(geom.attributes.position.count).toBe(0);
    geom.dispose();
  });

  it('has a size attribute matching the position count', () => {
    const geom = buildStarGeometry(mockCatalog, 6.5);
    expect(geom.attributes.size.count).toBe(geom.attributes.position.count);
    geom.dispose();
  });

  it('positions lie on the STAR_SPHERE_RADIUS sphere', () => {
    const geom = buildStarGeometry(mockCatalog, 6.5);
    const pos  = geom.attributes.position.array as Float32Array;

    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], y = pos[i + 1], z = pos[i + 2];
      const dist = Math.sqrt(x * x + y * y + z * z);
      expect(dist).toBeCloseTo(STAR_SPHERE_RADIUS, 0);
    }
    geom.dispose();
  });
});
