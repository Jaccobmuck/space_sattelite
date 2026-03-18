import * as satellite from 'satellite.js';

export interface GroundTrackPoint {
  lat: number;
  lng: number;
  alt: number;
  time: Date;
}

export interface GroundTrack {
  past: GroundTrackPoint[];
  future: GroundTrackPoint[];
}

export interface OrbitalElements {
  inclination: number;
  raan: number;
  eccentricity: number;
  argOfPerigee: number;
  meanMotion: number;
  period: number;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Compute ground track points for a satellite over a time range
 * @param tle1 - First line of TLE
 * @param tle2 - Second line of TLE
 * @param centerTime - Center time for the ground track
 * @param durationMinutes - Duration in minutes for each direction (past/future)
 * @param sampleIntervalSeconds - Interval between samples in seconds
 */
export function computeGroundTrack(
  tle1: string,
  tle2: string,
  centerTime: Date = new Date(),
  durationMinutes: number = 90,
  sampleIntervalSeconds: number = 60
): GroundTrack | null {
  try {
    const satrec = satellite.twoline2satrec(tle1, tle2);
    if (satrec.error !== 0) return null;

    const past: GroundTrackPoint[] = [];
    const future: GroundTrackPoint[] = [];

    const durationMs = durationMinutes * 60 * 1000;
    const intervalMs = sampleIntervalSeconds * 1000;

    // Compute past track (going backwards)
    for (let offset = -durationMs; offset < 0; offset += intervalMs) {
      const time = new Date(centerTime.getTime() + offset);
      const point = propagateToGroundTrackPoint(satrec, time);
      if (point) past.push(point);
    }

    // Compute future track (going forwards)
    for (let offset = 0; offset <= durationMs; offset += intervalMs) {
      const time = new Date(centerTime.getTime() + offset);
      const point = propagateToGroundTrackPoint(satrec, time);
      if (point) future.push(point);
    }

    return { past, future };
  } catch {
    return null;
  }
}

/**
 * Propagate satellite to a specific time and return ground track point
 */
function propagateToGroundTrackPoint(
  satrec: satellite.SatRec,
  time: Date
): GroundTrackPoint | null {
  try {
    const positionAndVelocity = satellite.propagate(satrec, time);

    if (
      typeof positionAndVelocity.position === 'boolean' ||
      !positionAndVelocity.position
    ) {
      return null;
    }

    const positionEci = positionAndVelocity.position;
    const gmst = satellite.gstime(time);
    const positionGd = satellite.eciToGeodetic(positionEci, gmst);

    return {
      lat: satellite.degreesLat(positionGd.latitude),
      lng: satellite.degreesLong(positionGd.longitude),
      alt: positionGd.height,
      time,
    };
  } catch {
    return null;
  }
}

/**
 * Extract orbital elements from TLE
 */
export function getOrbitalElements(tle1: string, tle2: string): OrbitalElements | null {
  try {
    const satrec = satellite.twoline2satrec(tle1, tle2);
    if (satrec.error !== 0) return null;

    const meanMotionRadPerMin = satrec.no; // radians per minute
    const meanMotionRevPerDay = (meanMotionRadPerMin * 1440) / (2 * Math.PI);
    const periodMinutes = 1440 / meanMotionRevPerDay;

    return {
      inclination: satrec.inclo * (180 / Math.PI), // Convert to degrees
      raan: satrec.nodeo * (180 / Math.PI), // Right Ascension of Ascending Node
      eccentricity: satrec.ecco,
      argOfPerigee: satrec.argpo * (180 / Math.PI),
      meanMotion: meanMotionRevPerDay,
      period: periodMinutes,
    };
  } catch {
    return null;
  }
}

/**
 * Calculate satellite footprint half-angle in radians
 * @param altitudeKm - Satellite altitude in km
 */
export function calculateFootprintHalfAngle(altitudeKm: number): number {
  return Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm));
}

/**
 * Generate footprint circle points on the globe surface
 * @param centerLat - Satellite latitude in degrees
 * @param centerLng - Satellite longitude in degrees
 * @param altitudeKm - Satellite altitude in km
 * @param numPoints - Number of points to generate (default 64)
 */
export function generateFootprintCircle(
  centerLat: number,
  centerLng: number,
  altitudeKm: number,
  numPoints: number = 64
): { lat: number; lng: number }[] {
  const halfAngle = calculateFootprintHalfAngle(altitudeKm);
  const angularRadius = halfAngle * (180 / Math.PI); // Convert to degrees

  const points: { lat: number; lng: number }[] = [];
  const centerLatRad = centerLat * (Math.PI / 180);
  const centerLngRad = centerLng * (Math.PI / 180);

  for (let i = 0; i <= numPoints; i++) {
    const bearing = (i / numPoints) * 2 * Math.PI;
    const angularRadiusRad = angularRadius * (Math.PI / 180);

    // Calculate point on great circle at given bearing and angular distance
    const lat = Math.asin(
      Math.sin(centerLatRad) * Math.cos(angularRadiusRad) +
      Math.cos(centerLatRad) * Math.sin(angularRadiusRad) * Math.cos(bearing)
    );

    const lng = centerLngRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angularRadiusRad) * Math.cos(centerLatRad),
      Math.cos(angularRadiusRad) - Math.sin(centerLatRad) * Math.sin(lat)
    );

    points.push({
      lat: lat * (180 / Math.PI),
      lng: lng * (180 / Math.PI),
    });
  }

  return points;
}

/**
 * Convert lat/lng/alt to 3D cartesian coordinates for Three.js
 * Earth radius = 1 in Three.js units
 */
export function latLngAltToCartesian(
  lat: number,
  lng: number,
  alt: number,
  earthRadius: number = 1
): { x: number; y: number; z: number } {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const radius = earthRadius + alt / EARTH_RADIUS_KM;

  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

/**
 * Convert lat/lng to 3D cartesian coordinates on Earth surface
 */
export function latLngToCartesian(
  lat: number,
  lng: number,
  earthRadius: number = 1
): { x: number; y: number; z: number } {
  return latLngAltToCartesian(lat, lng, 0, earthRadius);
}

/**
 * Get TLE epoch age in days
 */
export function getTLEEpochAge(tle1: string): number {
  try {
    // TLE line 1 format: columns 19-32 contain epoch (YY DDD.DDDDDDDD)
    const epochYear = parseInt(tle1.substring(18, 20), 10);
    const epochDay = parseFloat(tle1.substring(20, 32));

    // Convert 2-digit year to 4-digit
    const fullYear = epochYear < 57 ? 2000 + epochYear : 1900 + epochYear;

    // Create epoch date
    const epochDate = new Date(Date.UTC(fullYear, 0, 1));
    epochDate.setTime(epochDate.getTime() + (epochDay - 1) * 24 * 60 * 60 * 1000);

    // Calculate age in days
    const now = new Date();
    const ageMs = now.getTime() - epochDate.getTime();
    return ageMs / (24 * 60 * 60 * 1000);
  } catch {
    return 0;
  }
}
