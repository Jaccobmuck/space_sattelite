import {
  BufferGeometry,
  BufferAttribute,
  LineSegments,
  LineBasicMaterial,
  Group,
} from 'three';
import { STAR_SPHERE_RADIUS } from '../../constants/globe';
import { raDecToXYZ } from './StarField';

export interface ConstellationEndpoint {
  ra:  number; // hours
  dec: number; // degrees
}

export interface ConstellationLine {
  from: ConstellationEndpoint;
  to:   ConstellationEndpoint;
}

export interface ConstellationData {
  name:  string;
  lines: ConstellationLine[];
}

/** Line color: subtle white with low opacity */
const LINE_COLOR = 0x404060;

/**
 * Build a single THREE.LineSegments geometry for one constellation.
 *
 * @param lines  Array of line-segment definitions (each has from/to RA/Dec).
 * @returns      LineSegments geometry with 2 vertices per segment.
 */
export function buildConstellationGeometry(lines: ConstellationLine[]): BufferGeometry {
  const count     = lines.length;
  const positions = new Float32Array(count * 2 * 3); // 2 vertices × 3 coords

  lines.forEach((line, i) => {
    const [fx, fy, fz] = raDecToXYZ(line.from.ra, line.from.dec, STAR_SPHERE_RADIUS);
    const [tx, ty, tz] = raDecToXYZ(line.to.ra,   line.to.dec,   STAR_SPHERE_RADIUS);

    const base = i * 6;
    positions[base]     = fx;
    positions[base + 1] = fy;
    positions[base + 2] = fz;
    positions[base + 3] = tx;
    positions[base + 4] = ty;
    positions[base + 5] = tz;
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  return geometry;
}

/**
 * Compute the centroid RA/Dec of a constellation (average of all endpoints).
 * Used for label placement.
 */
export function computeConstellationCentroid(
  data: ConstellationData,
): { ra: number; dec: number } {
  let totalRa  = 0;
  let totalDec = 0;
  let count    = 0;

  data.lines.forEach(line => {
    totalRa  += line.from.ra  + line.to.ra;
    totalDec += line.from.dec + line.to.dec;
    count    += 2;
  });

  if (count === 0) return { ra: 0, dec: 0 };
  return { ra: totalRa / count, dec: totalDec / count };
}

/**
 * Build a THREE.Group containing one LineSegments per constellation.
 * The group starts visible; toggle with group.visible.
 *
 * @param catalog  Array of constellation data from public/data/constellations.json
 * @returns        Group containing all constellation line meshes.
 */
export function buildConstellationGroup(catalog: ConstellationData[]): Group {
  const material = new LineBasicMaterial({
    color:       LINE_COLOR,
    transparent: true,
    opacity:     0.25,
    depthWrite:  false,
  });

  const group = new Group();
  group.name  = 'ConstellationOverlay';

  catalog.forEach(constellation => {
    if (constellation.lines.length === 0) return;
    const geometry = buildConstellationGeometry(constellation.lines);
    const mesh     = new LineSegments(geometry, material);
    mesh.name      = constellation.name;
    mesh.userData  = { constellationName: constellation.name };
    group.add(mesh);
  });

  return group;
}
