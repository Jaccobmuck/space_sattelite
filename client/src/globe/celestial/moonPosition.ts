/**
 * Low-precision lunar ephemeris (Meeus "Astronomical Algorithms", Ch. 47 simplified).
 * Accuracy: ~1° for ecliptic longitude — sufficient for a visual moon marker.
 */

export interface MoonPositionResult {
  /** Right ascension in radians [0, 2π) */
  ra: number;
  /** Declination in radians */
  dec: number;
  /** Distance in Earth radii */
  distance: number;
}

const DEG = Math.PI / 180;

function julianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

function norm(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Compute the Moon's equatorial coordinates for the given date.
 * Based on Meeus Ch. 47 low-precision algorithm.
 */
export function getMoonPosition(date: Date): MoonPositionResult {
  const JD = julianDate(date);
  const T  = (JD - 2_451_545.0) / 36_525; // Julian centuries from J2000.0

  // Fundamental arguments (degrees)
  const L0 = norm(218.3165 + 481_267.8813 * T); // Moon's mean longitude
  const M  = norm(357.5291 +  35_999.0503 * T); // Sun's mean anomaly
  const Mp = norm(134.9634 + 477_198.8676 * T); // Moon's mean anomaly
  const F  = norm( 93.2721 + 483_202.0175 * T); // Moon's argument of latitude
  const D  = norm(297.8502 + 445_267.1115 * T); // Moon's mean elongation

  // Periodic corrections to ecliptic longitude (degrees)
  const dL =
      6.289 * Math.sin(Mp * DEG)
    + 1.274 * Math.sin((2 * D - Mp) * DEG)
    + 0.658 * Math.sin(2 * D * DEG)
    + 0.214 * Math.sin(2 * Mp * DEG)
    - 0.186 * Math.sin(M  * DEG)
    - 0.114 * Math.sin(2 * F  * DEG);

  // Periodic correction to ecliptic latitude (degrees)
  const B =
      5.128 * Math.sin(F  * DEG)
    + 0.281 * Math.sin((Mp + F) * DEG)
    - 0.272 * Math.sin((Mp - F) * DEG)
    - 0.173 * Math.sin((2 * D - F) * DEG);

  const lambdaRad = (L0 + dL) * DEG; // ecliptic longitude
  const betaRad   = B * DEG;          // ecliptic latitude

  // Obliquity of ecliptic (approximate)
  const epsilonRad = (23.439 - 0.000_000_4 * T) * DEG;

  // Ecliptic → Equatorial
  const sinLambda = Math.sin(lambdaRad);
  const cosLambda = Math.cos(lambdaRad);
  const sinBeta   = Math.sin(betaRad);
  const cosBeta   = Math.cos(betaRad);
  const sinEps    = Math.sin(epsilonRad);
  const cosEps    = Math.cos(epsilonRad);

  const ra  = Math.atan2(sinLambda * cosEps - Math.tan(betaRad) * sinEps, cosLambda);
  const dec = Math.asin(sinBeta * cosEps + cosBeta * sinEps * sinLambda);

  // Distance (Earth radii) — rough
  const dist = 60.2 - 3.3 * Math.cos(Mp * DEG) - 0.64 * Math.cos((2 * D - Mp) * DEG);

  return {
    ra:       ra < 0 ? ra + 2 * Math.PI : ra,
    dec,
    distance: dist,
  };
}
