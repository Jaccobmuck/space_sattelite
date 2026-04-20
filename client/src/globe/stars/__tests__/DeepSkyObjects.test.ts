import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import {
  dsoToXYZ,
  filterDsoByMagnitude,
  buildDsoGroup,
  getDsoFromIntersection,
} from '../DeepSkyObjects';
import type { DsoEntry } from '../DeepSkyObjects';
import { STAR_SPHERE_RADIUS, DSO_VISIBILITY_MAG_THRESHOLD } from '../../../constants/globe';

const sampleCatalog: DsoEntry[] = [
  {
    id: 'M31', name: 'Andromeda Galaxy', type: 'galaxy',
    ra: 0.7122, dec: 41.2692, mag: 3.4,
    description: 'Nearest large spiral galaxy',
  },
  {
    id: 'M42', name: 'Orion Nebula', type: 'nebula',
    ra: 5.5875, dec: -5.39, mag: 4.0,
    description: 'Diffuse nebula in Orion',
  },
  {
    id: 'M45', name: 'Pleiades', type: 'cluster',
    ra: 3.7914, dec: 24.1053, mag: 1.6,
    description: 'Seven Sisters open cluster',
  },
  {
    id: 'M91', name: 'M91', type: 'galaxy',
    ra: 12.5917, dec: 14.4958, mag: 10.2,  // above threshold
    description: 'Barred spiral',
  },
  {
    id: 'M76', name: 'Little Dumbbell', type: 'nebula',
    ra: 1.7019, dec: 51.5753, mag: 10.1,  // above threshold
    description: 'Planetary nebula',
  },
];

describe('dsoToXYZ', () => {
  it('places objects on the star sphere', () => {
    for (const dso of sampleCatalog) {
      const [x, y, z] = dsoToXYZ(dso.ra, dso.dec);
      const dist = Math.sqrt(x * x + y * y + z * z);
      expect(dist).toBeCloseTo(STAR_SPHERE_RADIUS, 0);
    }
  });

  it('Andromeda Galaxy (Dec=41°) has positive y', () => {
    const [, y] = dsoToXYZ(0.7122, 41.2692);
    expect(y).toBeGreaterThan(0);
  });

  it('Orion Nebula (Dec=-5.4°) has negative y', () => {
    const [, y] = dsoToXYZ(5.5875, -5.39);
    expect(y).toBeLessThan(0);
  });
});

describe('filterDsoByMagnitude', () => {
  it('excludes objects above the threshold', () => {
    const filtered = filterDsoByMagnitude(sampleCatalog, DSO_VISIBILITY_MAG_THRESHOLD);
    const ids = filtered.map(d => d.id);
    expect(ids).not.toContain('M91');  // mag=10.2
    expect(ids).not.toContain('M76');  // mag=10.1
  });

  it('includes objects at or below the threshold', () => {
    const filtered = filterDsoByMagnitude(sampleCatalog, DSO_VISIBILITY_MAG_THRESHOLD);
    expect(filtered.some(d => d.id === 'M31')).toBe(true);
    expect(filtered.some(d => d.id === 'M42')).toBe(true);
    expect(filtered.some(d => d.id === 'M45')).toBe(true);
  });

  it('returns empty array when threshold is very strict', () => {
    expect(filterDsoByMagnitude(sampleCatalog, -1)).toHaveLength(0);
  });

  it('returns all entries when threshold is very permissive', () => {
    expect(filterDsoByMagnitude(sampleCatalog, 99)).toHaveLength(sampleCatalog.length);
  });
});

describe('buildDsoGroup', () => {
  it('returns a Group', () => {
    const group = buildDsoGroup(sampleCatalog);
    expect(group).toBeInstanceOf(Group);
  });

  it('group starts with visible = false', () => {
    const group = buildDsoGroup(sampleCatalog);
    expect(group.visible).toBe(false);
  });

  it('group.userData.dsoEntries holds filtered catalog', () => {
    const group   = buildDsoGroup(sampleCatalog);
    const entries = group.userData.dsoEntries as DsoEntry[];
    // 3 objects below threshold (M31=3.4, M42=4.0, M45=1.6)
    expect(entries).toHaveLength(3);
  });

  it('group contains children (Points per type)', () => {
    const group = buildDsoGroup(sampleCatalog);
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('only includes objects with mag <= DSO_VISIBILITY_MAG_THRESHOLD', () => {
    const group   = buildDsoGroup(sampleCatalog);
    const entries = group.userData.dsoEntries as DsoEntry[];
    for (const e of entries) {
      expect(e.mag).toBeLessThanOrEqual(DSO_VISIBILITY_MAG_THRESHOLD);
    }
  });
});

describe('getDsoFromIntersection', () => {
  const filtered = filterDsoByMagnitude(sampleCatalog, DSO_VISIBILITY_MAG_THRESHOLD);

  it('returns correct DSO by type and index', () => {
    const galaxies = filtered.filter(d => d.type === 'galaxy');
    const found    = getDsoFromIntersection(filtered, 'galaxy', 0);
    expect(found).not.toBeNull();
    expect(found!.type).toBe('galaxy');
    expect(found!.id).toBe(galaxies[0].id);
  });

  it('returns null for out-of-range instanceId', () => {
    expect(getDsoFromIntersection(filtered, 'cluster', 999)).toBeNull();
  });

  it('tooltip content matches the DSO name and type', () => {
    const nebulae = filtered.filter(d => d.type === 'nebula');
    const found   = getDsoFromIntersection(filtered, 'nebula', 0);
    expect(found).not.toBeNull();
    expect(found!.name).toBe(nebulae[0].name);
    expect(found!.type).toBe('nebula');
    expect(found!.description).toBeTruthy();
  });
});
