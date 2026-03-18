import * as satellite from 'satellite.js';

export interface SatellitePosition {
  lat: number;
  lng: number;
  alt: number;
  velocity: number;
  period: number;
  inclination: number;
}

export interface OrbitPoint {
  lat: number;
  lng: number;
  alt: number;
  time: Date;
}

export function propagateSatellite(
  tle1: string,
  tle2: string,
  date: Date = new Date()
): SatellitePosition | null {
  try {
    const satrec = satellite.twoline2satrec(tle1, tle2);

    if (satrec.error !== 0) {
      return null;
    }

    const positionAndVelocity = satellite.propagate(satrec, date);

    if (
      typeof positionAndVelocity.position === 'boolean' ||
      typeof positionAndVelocity.velocity === 'boolean'
    ) {
      return null;
    }

    const positionEci = positionAndVelocity.position;
    const velocityEci = positionAndVelocity.velocity;

    const gmst = satellite.gstime(date);
    const positionGd = satellite.eciToGeodetic(positionEci, gmst);

    const lat = satellite.degreesLat(positionGd.latitude);
    const lng = satellite.degreesLong(positionGd.longitude);
    const alt = positionGd.height;

    const velocity = Math.sqrt(
      velocityEci.x ** 2 + velocityEci.y ** 2 + velocityEci.z ** 2
    );

    const period = (2 * Math.PI) / satrec.no;
    const inclination = satrec.inclo * (180 / Math.PI);

    return {
      lat,
      lng,
      alt,
      velocity,
      period,
      inclination,
    };
  } catch (error) {
    console.error('Propagation error:', error);
    return null;
  }
}

export function propagateOrbit(
  tle1: string,
  tle2: string,
  durationMinutes: number = 90,
  stepMinutes: number = 1
): OrbitPoint[] {
  const points: OrbitPoint[] = [];
  const now = new Date();

  for (let i = 0; i <= durationMinutes; i += stepMinutes) {
    const time = new Date(now.getTime() + i * 60 * 1000);
    const position = propagateSatellite(tle1, tle2, time);

    if (position) {
      points.push({
        lat: position.lat,
        lng: position.lng,
        alt: position.alt,
        time,
      });
    }
  }

  return points;
}

export function propagateGroundTrack(
  tle1: string,
  tle2: string,
  durationMinutes: number = 90,
  stepMinutes: number = 1
): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  const now = new Date();

  for (let i = 0; i <= durationMinutes; i += stepMinutes) {
    const time = new Date(now.getTime() + i * 60 * 1000);
    const position = propagateSatellite(tle1, tle2, time);

    if (position) {
      points.push({
        lat: position.lat,
        lng: position.lng,
      });
    }
  }

  return points;
}
