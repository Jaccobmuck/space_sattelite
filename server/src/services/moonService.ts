const LUNAR_CYCLE = 29.53058867;

export interface MoonData {
  phase: number;
  phaseName: string;
  illumination: number;
  nextFullMoon: string;
  nextNewMoon: string;
  moonrise: string | null;
  moonset: string | null;
  age: number;
}

function getMoonAge(date: Date): number {
  const knownNewMoon = new Date('2000-01-06T18:14:00Z');
  const diff = date.getTime() - knownNewMoon.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  return days % LUNAR_CYCLE;
}

function getMoonPhase(age: number): number {
  return age / LUNAR_CYCLE;
}

function getPhaseName(phase: number): string {
  if (phase < 0.0625) return 'New Moon';
  if (phase < 0.1875) return 'Waxing Crescent';
  if (phase < 0.3125) return 'First Quarter';
  if (phase < 0.4375) return 'Waxing Gibbous';
  if (phase < 0.5625) return 'Full Moon';
  if (phase < 0.6875) return 'Waning Gibbous';
  if (phase < 0.8125) return 'Last Quarter';
  if (phase < 0.9375) return 'Waning Crescent';
  return 'New Moon';
}

function getIllumination(phase: number): number {
  const angle = phase * 2 * Math.PI;
  return Math.round((1 - Math.cos(angle)) / 2 * 100);
}

function getNextMoonEvent(date: Date, targetPhase: number): Date {
  const age = getMoonAge(date);
  const currentPhase = age / LUNAR_CYCLE;

  let daysUntil: number;
  if (targetPhase > currentPhase) {
    daysUntil = (targetPhase - currentPhase) * LUNAR_CYCLE;
  } else {
    daysUntil = (1 - currentPhase + targetPhase) * LUNAR_CYCLE;
  }

  return new Date(date.getTime() + daysUntil * 24 * 60 * 60 * 1000);
}

export function calculateMoonData(
  date: Date = new Date(),
  _lat?: number,
  _lng?: number
): MoonData {
  const age = getMoonAge(date);
  const phase = getMoonPhase(age);
  const phaseName = getPhaseName(phase);
  const illumination = getIllumination(phase);

  const nextFullMoon = getNextMoonEvent(date, 0.5);
  const nextNewMoon = getNextMoonEvent(date, 0);

  return {
    phase: Math.round(phase * 1000) / 1000,
    phaseName,
    illumination,
    nextFullMoon: nextFullMoon.toISOString(),
    nextNewMoon: nextNewMoon.toISOString(),
    moonrise: null,
    moonset: null,
    age: Math.round(age * 10) / 10,
  };
}
