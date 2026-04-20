import { BufferGeometry, BufferAttribute } from 'three';
import {
  STAR_SPHERE_RADIUS,
  STAR_MAGNITUDE_THRESHOLD,
} from '../../constants/globe';

export interface StarCatalogEntry {
  /** Right ascension in decimal hours [0, 24) */
  ra: number;
  /** Declination in decimal degrees [-90, 90] */
  dec: number;
  /** Apparent visual magnitude (lower = brighter) */
  mag: number;
  /** Optional IAU/common name */
  name?: string;
}

/**
 * Convert RA (hours) + Dec (degrees) to 3-D Cartesian coordinates on a sphere.
 *
 *   x = r · cos(dec) · cos(ra)
 *   y = r · sin(dec)
 *   z = r · cos(dec) · sin(ra)
 */
export function raDecToXYZ(
  raHours: number,
  decDeg:  number,
  radius:  number,
): [number, number, number] {
  const raRad  = (raHours / 24) * 2 * Math.PI;
  const decRad = decDeg  * (Math.PI / 180);
  return [
    radius * Math.cos(decRad) * Math.cos(raRad),
    radius * Math.sin(decRad),
    radius * Math.cos(decRad) * Math.sin(raRad),
  ];
}

/**
 * Convert apparent magnitude to a point-size value.
 * Uses a logarithmic scale so that bright stars (mag ≈ −1) appear ~4× larger
 * than faint stars (mag ≈ 6).
 */
export function magToSize(mag: number): number {
  return Math.max(0.4, Math.log(1 + (7 - mag)) * 0.75);
}

/**
 * Build a BufferGeometry (for use with THREE.Points) from a star catalog.
 *
 * @param catalog      Array of star entries from the Yale BSC5 JSON asset.
 * @param magThreshold Only include stars with mag ≤ threshold.
 * @returns            BufferGeometry with 'position' and 'size' attributes.
 */
export function buildStarGeometry(
  catalog:      StarCatalogEntry[],
  magThreshold: number = STAR_MAGNITUDE_THRESHOLD,
): BufferGeometry {
  const filtered = catalog.filter(s => s.mag <= magThreshold);
  const count    = filtered.length;

  const positions = new Float32Array(count * 3);
  const sizes     = new Float32Array(count);

  filtered.forEach((star, i) => {
    const [x, y, z] = raDecToXYZ(star.ra, star.dec, STAR_SPHERE_RADIUS);
    positions[i * 3]     = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    sizes[i]             = magToSize(star.mag);
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('size',     new BufferAttribute(sizes,     1));
  return geometry;
}
