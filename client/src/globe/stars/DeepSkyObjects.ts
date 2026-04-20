import {
  BufferGeometry,
  BufferAttribute,
  Group,
  Points,
  PointsMaterial,
  Color,
} from 'three';
import { STAR_SPHERE_RADIUS, DSO_VISIBILITY_MAG_THRESHOLD } from '../../constants/globe';
import { raDecToXYZ } from './StarField';

export type DsoType = 'nebula' | 'galaxy' | 'cluster' | 'other';

export interface DsoEntry {
  id:          string;
  name:        string;
  type:        DsoType;
  ra:          number;  // hours
  dec:         number;  // degrees
  mag:         number;
  description: string;
}

/** Colors per DSO type */
const DSO_COLORS: Record<DsoType, number> = {
  galaxy:  0xff9944,  // warm orange
  nebula:  0x44bbff,  // blue-white
  cluster: 0xffff88,  // pale yellow
  other:   0xcccccc,  // neutral
};

/** Base point size for DSO markers (screen pixels) */
const BASE_SIZE = 3.0;

/**
 * Convert RA/Dec to an XYZ position on the star sphere.
 * Exposed so tests can assert distance from origin.
 */
export function dsoToXYZ(ra: number, dec: number): [number, number, number] {
  return raDecToXYZ(ra, dec, STAR_SPHERE_RADIUS);
}

/**
 * Filter a DSO catalog to only include objects visible in the default view.
 */
export function filterDsoByMagnitude(
  catalog:   DsoEntry[],
  threshold: number = DSO_VISIBILITY_MAG_THRESHOLD,
): DsoEntry[] {
  return catalog.filter(d => d.mag <= threshold);
}

/**
 * Build a THREE.Group containing one Points object per DSO type,
 * each point representing a deep-sky object.
 *
 * The returned group starts hidden (visible = false); reveal on toggle.
 *
 * @param catalog  Raw DSO catalog from public/data/deepsky.json.
 * @returns        Group with DSO markers; group.userData.dsoEntries holds filtered array.
 */
export function buildDsoGroup(catalog: DsoEntry[]): Group {
  const filtered = filterDsoByMagnitude(catalog);
  const group    = new Group();
  group.name     = 'DeepSkyObjects';
  group.visible  = false;

  // Group by type for distinct materials
  const byType = new Map<DsoType, DsoEntry[]>();
  for (const entry of filtered) {
    const list = byType.get(entry.type) ?? [];
    list.push(entry);
    byType.set(entry.type, list);
  }

  byType.forEach((entries, type) => {
    const count     = entries.length;
    const positions = new Float32Array(count * 3);

    entries.forEach((dso, i) => {
      const [x, y, z] = dsoToXYZ(dso.ra, dso.dec);
      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    });

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));

    const material = new PointsMaterial({
      color:           new Color(DSO_COLORS[type]),
      size:            BASE_SIZE,
      sizeAttenuation: false,
      depthWrite:      false,
      transparent:     true,
      opacity:         0.85,
    });

    const points    = new Points(geometry, material);
    points.name     = `DSO_${type}`;
    points.userData = { entries, type };
    group.add(points);
  });

  // Expose filtered catalog on the group for tooltip lookup
  group.userData = { dsoEntries: filtered };

  return group;
}

/**
 * Find a DSO entry by type and index within that type's sub-array.
 * Used for tooltip display on hover/click.
 */
export function getDsoFromIntersection(
  dsoEntries: DsoEntry[],
  type:       DsoType,
  instanceId: number,
): DsoEntry | null {
  const forType = dsoEntries.filter(d => d.type === type);
  return forType[instanceId] ?? null;
}
