import { describe, it, expect } from 'vitest';
import { Vector3, Euler, Matrix4, Object3D } from 'three';
import { composeMatrix } from '../SatelliteInstanceManager';

describe('composeMatrix', () => {
  it('produces a Matrix4 with the correct translation', () => {
    const pos    = new Vector3(1, 2, 3);
    const matrix = composeMatrix(pos, 1.0);

    // Column-major: elements[12], [13], [14] are translation x, y, z
    expect(matrix.elements[12]).toBeCloseTo(1, 5);
    expect(matrix.elements[13]).toBeCloseTo(2, 5);
    expect(matrix.elements[14]).toBeCloseTo(3, 5);
  });

  it('produces a Matrix4 with the correct uniform scale', () => {
    const pos    = new Vector3(0, 0, 0);
    const scale  = 1.4;
    const matrix = composeMatrix(pos, scale);

    // For a pure scale matrix (no rotation, at origin):
    // elements[0], [5], [10] are scale x, y, z
    expect(matrix.elements[0]).toBeCloseTo(scale, 5);
    expect(matrix.elements[5]).toBeCloseTo(scale, 5);
    expect(matrix.elements[10]).toBeCloseTo(scale, 5);
  });

  it('SELECTED_SATELLITE_SCALE of 1.4 is reflected in the scale components', () => {
    const SELECTED_SATELLITE_SCALE = 1.4;
    const matrix = composeMatrix(new Vector3(0, 0, 0), SELECTED_SATELLITE_SCALE);
    expect(matrix.elements[0]).toBeCloseTo(SELECTED_SATELLITE_SCALE, 5);
  });

  it('rotation is applied when Euler is provided', () => {
    const pos    = new Vector3(0, 0, 0);
    const euler  = new Euler(Math.PI / 2, 0, 0); // 90° around X
    const matrix = composeMatrix(pos, 1.0, euler);

    // At scale=1, no translation: use a dummy Object3D to generate reference
    const dummy = new Object3D();
    dummy.rotation.copy(euler);
    dummy.scale.setScalar(1.0);
    dummy.position.set(0, 0, 0);
    dummy.updateMatrix();

    const ref = dummy.matrix;
    // Compare all 16 elements
    for (let i = 0; i < 16; i++) {
      expect(matrix.elements[i]).toBeCloseTo(ref.elements[i], 4);
    }
  });

  it('returns a NEW Matrix4 on every call (no shared reference)', () => {
    const pos = new Vector3(1, 0, 0);
    const m1  = composeMatrix(pos, 1.0);
    const m2  = composeMatrix(pos, 1.0);
    expect(m1).not.toBe(m2);
  });

  it('scale=1.0 produces an identity-scale matrix (no size change)', () => {
    const matrix = composeMatrix(new Vector3(0, 0, 0), 1.0);
    expect(matrix.elements[0]).toBeCloseTo(1.0, 5);
    expect(matrix.elements[5]).toBeCloseTo(1.0, 5);
    expect(matrix.elements[10]).toBeCloseTo(1.0, 5);
  });

  it('combining position and scale works correctly', () => {
    const pos   = new Vector3(5, -3, 2);
    const scale = 2.5;
    const matrix = composeMatrix(pos, scale);

    expect(matrix.elements[12]).toBeCloseTo(5,  5);
    expect(matrix.elements[13]).toBeCloseTo(-3, 5);
    expect(matrix.elements[14]).toBeCloseTo(2,  5);
    expect(matrix.elements[0]).toBeCloseTo(scale, 5);
  });
});
