import { describe, it, expect } from 'vitest';
import { BufferGeometry } from 'three';
import { getSatelliteGeometry } from '../SatelliteGeometry';
import { SATELLITE_TYPES } from '../../../types/satellite';
import type { SatelliteType } from '../../../types/satellite';

describe('getSatelliteGeometry', () => {
  it('returns a BufferGeometry for every SatelliteType', () => {
    for (const type of SATELLITE_TYPES) {
      const geom = getSatelliteGeometry(type as SatelliteType);
      expect(geom).toBeInstanceOf(BufferGeometry);
      geom.dispose();
    }
  });

  it('each geometry has a non-empty position attribute', () => {
    for (const type of SATELLITE_TYPES) {
      const geom = getSatelliteGeometry(type as SatelliteType);
      const pos  = geom.attributes.position;
      expect(pos, `${type} should have position attribute`).toBeDefined();
      expect(pos.count, `${type} position count should be > 0`).toBeGreaterThan(0);
      geom.dispose();
    }
  });

  it('debris geometry has position attribute', () => {
    const geom = getSatelliteGeometry('debris');
    expect(geom.attributes.position.count).toBeGreaterThan(0);
    geom.dispose();
  });

  it('unknown geometry has position attribute', () => {
    const geom = getSatelliteGeometry('unknown');
    expect(geom.attributes.position.count).toBeGreaterThan(0);
    geom.dispose();
  });

  it('each call returns a new geometry instance (no sharing)', () => {
    for (const type of SATELLITE_TYPES) {
      const g1 = getSatelliteGeometry(type as SatelliteType);
      const g2 = getSatelliteGeometry(type as SatelliteType);
      expect(g1).not.toBe(g2);
      g1.dispose();
      g2.dispose();
    }
  });

  it('disposing one geometry does not affect another of the same type', () => {
    const g1 = getSatelliteGeometry('comms');
    const g2 = getSatelliteGeometry('comms');
    g1.dispose();
    // g2 should still have valid attributes
    expect(g2.attributes.position.count).toBeGreaterThan(0);
    g2.dispose();
  });

  it('crewed geometry has more vertices than debris (ISS cross vs cylinder)', () => {
    const crewed = getSatelliteGeometry('crewed');
    const debris = getSatelliteGeometry('debris');
    expect(crewed.attributes.position.count).toBeGreaterThan(
      debris.attributes.position.count,
    );
    crewed.dispose();
    debris.dispose();
  });
});
