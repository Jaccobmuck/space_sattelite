import * as satellite from 'satellite.js';

function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

export interface Pass {
  satellite: string;
  noradId: number;
  riseTime: string;
  maxElevation: number;
  maxElevationTime: string;
  setTime: string;
  duration: number;
  azimuth: number;
  quality: 'poor' | 'good' | 'excellent';
}

interface ObserverLocation {
  lat: number;
  lng: number;
  alt: number;
}

function getElevation(
  satrec: satellite.SatRec,
  observer: ObserverLocation,
  date: Date
): number | null {
  try {
    const positionAndVelocity = satellite.propagate(satrec, date);

    if (typeof positionAndVelocity.position === 'boolean') {
      return null;
    }

    const positionEci = positionAndVelocity.position;
    const gmst = satellite.gstime(date);

    const observerGd = {
      longitude: satellite.degreesToRadians(observer.lng),
      latitude: satellite.degreesToRadians(observer.lat),
      height: observer.alt / 1000,
    };

    const positionEcf = satellite.eciToEcf(positionEci, gmst);
    const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

    return radiansToDegrees(lookAngles.elevation);
  } catch {
    return null;
  }
}

function getAzimuth(
  satrec: satellite.SatRec,
  observer: ObserverLocation,
  date: Date
): number | null {
  try {
    const positionAndVelocity = satellite.propagate(satrec, date);

    if (typeof positionAndVelocity.position === 'boolean') {
      return null;
    }

    const positionEci = positionAndVelocity.position;
    const gmst = satellite.gstime(date);

    const observerGd = {
      longitude: satellite.degreesToRadians(observer.lng),
      latitude: satellite.degreesToRadians(observer.lat),
      height: observer.alt / 1000,
    };

    const positionEcf = satellite.eciToEcf(positionEci, gmst);
    const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

    return radiansToDegrees(lookAngles.azimuth);
  } catch {
    return null;
  }
}

export function computePasses(
  name: string,
  noradId: number,
  tle1: string,
  tle2: string,
  observer: ObserverLocation,
  days: number = 5,
  minElevation: number = 10
): Pass[] {
  const passes: Pass[] = [];
  const satrec = satellite.twoline2satrec(tle1, tle2);

  if (satrec.error !== 0) {
    return passes;
  }

  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + days * 24 * 60 * 60 * 1000);
  const stepMs = 60 * 1000;

  let inPass = false;
  let riseTime: Date | null = null;
  let maxEl = 0;
  let maxElTime: Date | null = null;
  let riseAzimuth = 0;

  for (
    let time = startTime.getTime();
    time < endTime.getTime();
    time += stepMs
  ) {
    const date = new Date(time);
    const elevation = getElevation(satrec, observer, date);

    if (elevation === null) continue;

    if (elevation > 0 && !inPass) {
      inPass = true;
      riseTime = date;
      maxEl = elevation;
      maxElTime = date;
      riseAzimuth = getAzimuth(satrec, observer, date) || 0;
    } else if (elevation > 0 && inPass) {
      if (elevation > maxEl) {
        maxEl = elevation;
        maxElTime = date;
      }
    } else if (elevation <= 0 && inPass) {
      inPass = false;

      if (maxEl >= minElevation && riseTime && maxElTime) {
        const duration = Math.round((time - riseTime.getTime()) / 1000);

        let quality: Pass['quality'] = 'poor';
        if (maxEl >= 60) quality = 'excellent';
        else if (maxEl >= 30) quality = 'good';

        passes.push({
          satellite: name,
          noradId,
          riseTime: riseTime.toISOString(),
          maxElevation: Math.round(maxEl * 10) / 10,
          maxElevationTime: maxElTime.toISOString(),
          setTime: new Date(time).toISOString(),
          duration,
          azimuth: Math.round(riseAzimuth),
          quality,
        });
      }

      riseTime = null;
      maxElTime = null;
      maxEl = 0;
    }
  }

  return passes.slice(0, 10);
}
