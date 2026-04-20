import { describe, it, expect } from 'vitest';
import { classifySatellite } from '../classifySatellite';
import type { RawSatellite } from '../../../types/satellite';

describe('classifySatellite', () => {
  // ── OBJECT_TYPE primary signal ────────────────────────────────────────────
  it('classifies rocket bodies as debris via objectType', () => {
    expect(classifySatellite({ name: 'COSMOS 3M R/B', objectType: 'ROCKET BODY' })).toBe('debris');
  });

  it('classifies debris via objectType "DEBRIS"', () => {
    expect(classifySatellite({ name: 'SL-16 DEB', objectType: 'DEBRIS' })).toBe('debris');
  });

  it('objectType rocket body is case-insensitive', () => {
    expect(classifySatellite({ name: 'SL-8 R/B', objectType: 'rocket body' })).toBe('debris');
  });

  // ── Name-based debris ─────────────────────────────────────────────────────
  it('classifies name containing " deb" as debris', () => {
    expect(classifySatellite({ name: 'FENGYUN 1C DEB' })).toBe('debris');
  });

  it('classifies name containing "r/b" as debris', () => {
    expect(classifySatellite({ name: 'SL-14 R/B' })).toBe('debris');
  });

  // ── Crewed ────────────────────────────────────────────────────────────────
  it('classifies ISS as crewed', () => {
    expect(classifySatellite({ name: 'ISS (ZARYA)' })).toBe('crewed');
  });

  it('classifies Tiangong as crewed', () => {
    expect(classifySatellite({ name: 'TIANGONG-3' })).toBe('crewed');
  });

  // ── Comms ─────────────────────────────────────────────────────────────────
  it('classifies STARLINK as comms', () => {
    expect(classifySatellite({ name: 'STARLINK-1234' })).toBe('comms');
  });

  it('classifies ONEWEB as comms', () => {
    expect(classifySatellite({ name: 'ONEWEB-0123' })).toBe('comms');
  });

  it('classifies IRIDIUM as comms', () => {
    expect(classifySatellite({ name: 'IRIDIUM 33' })).toBe('comms');
  });

  // ── Weather ───────────────────────────────────────────────────────────────
  it('classifies GOES satellites as weather', () => {
    expect(classifySatellite({ name: 'GOES-18' })).toBe('weather');
  });

  it('classifies METEOSAT as weather', () => {
    expect(classifySatellite({ name: 'METEOSAT-11' })).toBe('weather');
  });

  // ── Navigation ────────────────────────────────────────────────────────────
  it('classifies GPS BIIR as nav', () => {
    expect(classifySatellite({ name: 'GPS BIIR-2 (PRN 13)' })).toBe('nav');
  });

  it('classifies GLONASS as nav', () => {
    expect(classifySatellite({ name: 'GLONASS-M' })).toBe('nav');
  });

  it('classifies GALILEO as nav', () => {
    expect(classifySatellite({ name: 'GALILEO 5' })).toBe('nav');
  });

  // ── Imagery ───────────────────────────────────────────────────────────────
  it('classifies LANDSAT as imagery', () => {
    expect(classifySatellite({ name: 'LANDSAT 8' })).toBe('imagery');
  });

  it('classifies WORLDVIEW as imagery', () => {
    expect(classifySatellite({ name: 'WORLDVIEW-4' })).toBe('imagery');
  });

  it('classifies SENTINEL as imagery', () => {
    expect(classifySatellite({ name: 'SENTINEL-2A' })).toBe('imagery');
  });

  // ── Scientific ────────────────────────────────────────────────────────────
  it('classifies Hubble as scientific', () => {
    expect(classifySatellite({ name: 'HUBBLE SPACE TELESCOPE' })).toBe('scientific');
  });

  it('classifies Chandra as scientific', () => {
    expect(classifySatellite({ name: 'CHANDRA X-RAY' })).toBe('scientific');
  });

  // ── Unknown / edge cases ──────────────────────────────────────────────────
  it('returns unknown for an unrecognised satellite name', () => {
    expect(classifySatellite({ name: 'SOME RANDOM SAT 42' })).toBe('unknown');
  });

  it('returns unknown for empty name', () => {
    expect(classifySatellite({ name: '' })).toBe('unknown');
  });

  it('returns unknown when name is undefined-ish (empty objectType)', () => {
    expect(classifySatellite({ name: 'XYZ-99', objectType: '' })).toBe('unknown');
  });

  it('debris via objectType takes priority over name keywords', () => {
    // name looks like comms but objectType says debris
    expect(classifySatellite({ name: 'STARLINK DEB', objectType: 'DEBRIS' })).toBe('debris');
  });

  it('debris keyword in name takes priority over comms keyword', () => {
    // name has both debris keyword and starlink
    expect(classifySatellite({ name: 'STARLINK-999 DEB' })).toBe('debris');
  });

  it('handles null-ish objectType gracefully', () => {
    // objectType explicitly undefined
    const sat: RawSatellite = { name: 'GOES-16', objectType: undefined };
    expect(classifySatellite(sat)).toBe('weather');
  });

  it('is case-insensitive for all keywords', () => {
    expect(classifySatellite({ name: 'starlink-5555' })).toBe('comms');
    expect(classifySatellite({ name: 'GOES-EAST' })).toBe('weather');
  });
});
