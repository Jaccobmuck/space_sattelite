import * as satellite from 'satellite.js';

export interface PropagatedPosition {
  lat: number;
  lng: number;
  alt: number;
  velocity: number;
}

export function propagateFromTLE(
  tle1: string,
  tle2: string,
  date: Date = new Date()
): PropagatedPosition | null {
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

    return { lat, lng, alt, velocity };
  } catch {
    return null;
  }
}

export function latLngToCartesian(
  lat: number,
  lng: number,
  alt: number,
  earthRadius: number = 1
): { x: number; y: number; z: number } {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const radius = earthRadius + alt / 6371;

  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}
