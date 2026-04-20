import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstancedMesh, Vector3 } from 'three';
import { SatelliteInstanceManager } from '../SatelliteInstanceManager';
import { SATELLITE_TYPES } from '../../../types/satellite';
import type { PropagatedSatellite } from '../SatelliteInstanceManager';
import type { Satellite } from '../../../types';

function makeScene() {
  const added: object[] = [];
  return { add: vi.fn((obj) => added.push(obj)), _added: added };
}

function makeSatellite(noradId: number, name = 'TEST'): Satellite {
  return {
    noradId,
    name,
    category: 'science',
    lat: 0, lng: 0, alt: 400,
    velocity: 7.8,
    period: 90,
    inclination: 51.6,
    owner: 'TEST',
    tle1: '', tle2: '',
  };
}

describe('SatelliteInstanceManager', () => {
  it('constructor adds exactly 8 InstancedMesh objects to the scene', () => {
    const scene = makeScene();
    const mgr   = new SatelliteInstanceManager(scene as never);

    expect(scene.add).toHaveBeenCalledTimes(8);
    expect(scene._added).toHaveLength(8);
    expect(scene._added.every(obj => obj instanceof InstancedMesh)).toBe(true);

    mgr.dispose();
  });

  it('creates one InstancedMesh per SatelliteType', () => {
    const scene = makeScene();
    const mgr   = new SatelliteInstanceManager(scene as never);
    const meshes = mgr.getMeshes();

    expect(meshes.size).toBe(SATELLITE_TYPES.length);
    for (const type of SATELLITE_TYPES) {
      expect(meshes.has(type)).toBe(true);
    }
    mgr.dispose();
  });

  it('update() sets mesh.count to the number of satellites of that type', () => {
    const scene = makeScene();
    const mgr   = new SatelliteInstanceManager(scene as never);

    const sats: PropagatedSatellite[] = [
      { satellite: makeSatellite(1, 'STARLINK-1'), type: 'comms',   position: new Vector3(1, 0, 0) },
      { satellite: makeSatellite(2, 'STARLINK-2'), type: 'comms',   position: new Vector3(2, 0, 0) },
      { satellite: makeSatellite(3, 'GOES-18'),    type: 'weather', position: new Vector3(3, 0, 0) },
    ];

    mgr.update(sats, null);

    const meshes = mgr.getMeshes();
    expect(meshes.get('comms')!.count).toBe(2);
    expect(meshes.get('weather')!.count).toBe(1);

    mgr.dispose();
  });

  it('update() with 0 satellites of a type sets mesh.count to 0', () => {
    const scene = makeScene();
    const mgr   = new SatelliteInstanceManager(scene as never);

    // First populate comms
    mgr.update([
      { satellite: makeSatellite(1), type: 'comms', position: new Vector3() },
    ], null);
    expect(mgr.getMeshes().get('comms')!.count).toBe(1);

    // Now clear all
    mgr.update([], null);
    for (const type of SATELLITE_TYPES) {
      expect(mgr.getMeshes().get(type)!.count).toBe(0);
    }
    mgr.dispose();
  });

  it('dispose() clears the internal mesh map', () => {
    const scene = makeScene();
    const mgr   = new SatelliteInstanceManager(scene as never);
    mgr.dispose();
    expect(mgr.getMeshes().size).toBe(0);
  });

  it('getSelectedSatelliteFromIntersection returns correct satellite', () => {
    const scene = makeScene();
    const mgr   = new SatelliteInstanceManager(scene as never);

    const sat1 = makeSatellite(100, 'SAT-A');
    const sat2 = makeSatellite(200, 'SAT-B');

    mgr.update([
      { satellite: sat1, type: 'nav', position: new Vector3(1, 0, 0) },
      { satellite: sat2, type: 'nav', position: new Vector3(2, 0, 0) },
    ], null);

    const navMesh = mgr.getMeshes().get('nav')!;
    const intersection = {
      object:     navMesh,
      instanceId: 1,
      distance:   1,
      point:      new Vector3(),
    } as never;

    const found = mgr.getSelectedSatelliteFromIntersection(intersection);
    expect(found).not.toBeNull();
    expect(found!.noradId).toBe(200);

    mgr.dispose();
  });

  it('getSelectedSatelliteFromIntersection returns null for missing userData.type', () => {
    const scene = makeScene();
    const mgr   = new SatelliteInstanceManager(scene as never);

    const fakeIntersection = {
      object:     { userData: {} },
      instanceId: 0,
      distance:   1,
      point:      new Vector3(),
    } as never;

    expect(mgr.getSelectedSatelliteFromIntersection(fakeIntersection)).toBeNull();
    mgr.dispose();
  });
});
