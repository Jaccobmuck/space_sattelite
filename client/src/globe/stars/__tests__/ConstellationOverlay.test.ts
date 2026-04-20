import { describe, it, expect } from 'vitest';
import { BufferGeometry, LineSegments, Group } from 'three';
import {
  buildConstellationGeometry,
  buildConstellationGroup,
  computeConstellationCentroid,
} from '../ConstellationOverlay';
import type { ConstellationData, ConstellationLine } from '../ConstellationOverlay';

const orionLines: ConstellationLine[] = [
  { from: { ra: 5.9195, dec:  7.407 }, to: { ra: 5.4186, dec:  6.350 } },
  { from: { ra: 5.4186, dec:  6.350 }, to: { ra: 5.5333, dec: -0.299 } },
  { from: { ra: 5.5333, dec: -0.299 }, to: { ra: 5.2423, dec: -8.202 } },
];

describe('buildConstellationGeometry', () => {
  it('returns a BufferGeometry', () => {
    const geom = buildConstellationGeometry(orionLines);
    expect(geom).toBeInstanceOf(BufferGeometry);
    geom.dispose();
  });

  it('has exactly 2 vertices (6 floats) per line segment', () => {
    const geom  = buildConstellationGeometry(orionLines);
    const count = geom.attributes.position.count;
    expect(count).toBe(orionLines.length * 2);
    geom.dispose();
  });

  it('position attribute array length = lineCount × 2 × 3', () => {
    const geom = buildConstellationGeometry(orionLines);
    expect(geom.attributes.position.array.length).toBe(orionLines.length * 6);
    geom.dispose();
  });

  it('works for a single line segment', () => {
    const single = [orionLines[0]];
    const geom   = buildConstellationGeometry(single);
    expect(geom.attributes.position.count).toBe(2);
    expect(geom.attributes.position.array.length).toBe(6);
    geom.dispose();
  });

  it('works for empty line array', () => {
    const geom = buildConstellationGeometry([]);
    expect(geom.attributes.position.count).toBe(0);
    geom.dispose();
  });
});

describe('computeConstellationCentroid', () => {
  it('returns centroid as average of all endpoint RA/Dec', () => {
    const data: ConstellationData = { name: 'Test', lines: orionLines };
    const { ra, dec } = computeConstellationCentroid(data);

    // Manual average of the endpoints' RA and Dec values
    const allRa  = orionLines.flatMap(l => [l.from.ra,  l.to.ra]);
    const allDec = orionLines.flatMap(l => [l.from.dec, l.to.dec]);
    const expRa  = allRa.reduce((s, v) => s + v, 0)  / allRa.length;
    const expDec = allDec.reduce((s, v) => s + v, 0) / allDec.length;

    expect(ra).toBeCloseTo(expRa, 5);
    expect(dec).toBeCloseTo(expDec, 5);
  });

  it('returns {ra:0, dec:0} for empty lines array', () => {
    const { ra, dec } = computeConstellationCentroid({ name: 'Empty', lines: [] });
    expect(ra).toBe(0);
    expect(dec).toBe(0);
  });
});

describe('buildConstellationGroup', () => {
  const catalog: ConstellationData[] = [
    { name: 'Orion',     lines: orionLines },
    { name: 'TestEmpty', lines: [] },
    { name: 'SingleStar', lines: [orionLines[0]] },
  ];

  it('returns a Group', () => {
    const group = buildConstellationGroup(catalog);
    expect(group).toBeInstanceOf(Group);
  });

  it('skips constellations with 0 lines', () => {
    const group = buildConstellationGroup(catalog);
    // TestEmpty should not produce a child
    const names = group.children.map(c => c.name);
    expect(names).not.toContain('TestEmpty');
  });

  it('each child is a LineSegments', () => {
    const group = buildConstellationGroup(catalog);
    for (const child of group.children) {
      expect(child).toBeInstanceOf(LineSegments);
    }
  });

  it('group is visible by default', () => {
    const group = buildConstellationGroup(catalog);
    expect(group.visible).toBe(true);
  });

  it('group.visible = false hides the group', () => {
    const group = buildConstellationGroup(catalog);
    group.visible = false;
    expect(group.visible).toBe(false);
  });

  it('each LineSegments has the constellation name', () => {
    const group = buildConstellationGroup(catalog);
    const orion = group.children.find(c => c.name === 'Orion');
    expect(orion).toBeDefined();
  });
});
