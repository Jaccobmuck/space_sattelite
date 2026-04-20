/**
 * Low-precision solar ephemeris (USNO / Meeus "Astronomical Algorithms", Ch. 25).
 * Accuracy: ~1° for current century — sufficient for a visual day/night terminator.
 */

export interface SunPositionResult {
  /** Right ascension in radians [0, 2π) */
  ra: number;
  /** Declination in radians */
  dec: number;
}

const DEG = Math.PI / 180;

function julianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

/**
 * Compute the Sun's equatorial coordinates for the given UTC date.
 * Based on the USNO low-precision algorithm.
 */
export function getSunPosition(date: Date): SunPositionResult {
  const JD = julianDate(date);
  const n  = JD - 2_451_545.0; // days from J2000.0

  // Mean longitude (degrees)
  const L = ((280.460 + 0.985_647_4 * n) % 360 + 360) % 360;

  // Mean anomaly (radians)
  const g = ((357.528 + 0.985_600_3 * n) % 360 + 360) % 360 * DEG;

  // Ecliptic longitude (degrees)
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG;

  // Obliquity of ecliptic (approximate, degrees → radians)
  const epsilon = (23.439 - 0.000_000_4 * n) * DEG;

  // Equatorial coordinates
  const sinLambda = Math.sin(lambda);
  const ra  = Math.atan2(Math.cos(epsilon) * sinLambda, Math.cos(lambda));
  const dec = Math.asin(Math.sin(epsilon)  * sinLambda);

  return {
    ra:  ra < 0 ? ra + 2 * Math.PI : ra,
    dec,
  };
}

/**
 * Convert RA/Dec to a normalised 3-D unit direction vector.
 *   x = cos(dec)·cos(ra)
 *   y = sin(dec)
 *   z = cos(dec)·sin(ra)
 */
export function sunPositionToDirection(pos: SunPositionResult): [number, number, number] {
  const cosDec = Math.cos(pos.dec);
  return [
    cosDec * Math.cos(pos.ra),
    Math.sin(pos.dec),
    cosDec * Math.sin(pos.ra),
  ];
}
