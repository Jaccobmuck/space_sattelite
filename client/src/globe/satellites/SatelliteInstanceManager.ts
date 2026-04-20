import {
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  Color,
  Vector3,
  Euler,
  Matrix4,
} from 'three';
import type { Scene, Intersection } from 'three';

import { getSatelliteGeometry } from './SatelliteGeometry';
import {
  SATELLITE_TYPE_COLORS,
  MAX_SATELLITES_PER_TYPE,
  SELECTED_SATELLITE_SCALE,
} from '../../constants/globe';
import { SATELLITE_TYPES } from '../../types/satellite';
import type { SatelliteType } from '../../types/satellite';
import type { Satellite } from '../../types';

export interface PropagatedSatellite {
  satellite: Satellite;
  type:      SatelliteType;
  position:  Vector3;
}

interface ManagedEntry {
  satellite:     Satellite;
  instanceIndex: number;
}

/**
 * Compose an instance matrix from position, scale, and optional rotation.
 *
 * @param position  3-D world-space position.
 * @param scale     Uniform scale factor.
 * @param rotation  Optional Euler rotation (e.g. for orientation).
 * @returns         A NEW Matrix4 — caller owns it.
 */
export function composeMatrix(
  position: Vector3,
  scale:    number,
  rotation: Euler = new Euler(),
): Matrix4 {
  const dummy = new Object3D();
  dummy.position.copy(position);
  dummy.scale.setScalar(scale);
  dummy.rotation.copy(rotation);
  dummy.updateMatrix();
  return dummy.matrix.clone();
}

/**
 * Manages one THREE.InstancedMesh per SatelliteType (8 total).
 *
 * Lifecycle:
 *   const mgr = new SatelliteInstanceManager(scene);
 *   // every frame:
 *   mgr.update(propagatedSats, selectedNoradId);
 *   // on unmount:
 *   mgr.dispose();
 */
export class SatelliteInstanceManager {
  private readonly meshes:       Map<SatelliteType, InstancedMesh>  = new Map();
  private readonly typeIndexMap: Map<SatelliteType, ManagedEntry[]> = new Map();
  private readonly selectedColor  = new Color(0xffffff);

  constructor(scene: Pick<Scene, 'add'>) {
    for (const type of SATELLITE_TYPES) {
      const geometry = getSatelliteGeometry(type);
      // MeshBasicMaterial: unlit, so satellites are always fully visible
      // regardless of scene lighting. instanceColor drives per-satellite colour.
      const material = new MeshBasicMaterial({
        color: new Color(0xffffff), // white base; instanceColor overrides per-instance
        vertexColors: false,
      });
      const mesh          = new InstancedMesh(geometry, material, MAX_SATELLITES_PER_TYPE);
      mesh.count          = 0;
      mesh.frustumCulled  = false;
      mesh.name           = `satellites_${type}`;
      mesh.userData.type  = type;
      scene.add(mesh);
      this.meshes.set(type, mesh);
      this.typeIndexMap.set(type, []);
    }
  }

  /**
   * Update all instance matrices and colors for the current frame.
   *
   * @param satellites   Array of propagated satellite records grouped by type.
   * @param selectedId   noradId of the currently selected satellite (or null).
   */
  update(satellites: PropagatedSatellite[], selectedId: number | null): void {
    // Bucket by type
    const byType = new Map<SatelliteType, PropagatedSatellite[]>();
    for (const type of SATELLITE_TYPES) byType.set(type, []);
    for (const s of satellites) byType.get(s.type)!.push(s);

    for (const type of SATELLITE_TYPES) {
      const mesh    = this.meshes.get(type)!;
      const entries = byType.get(type)!;
      const managed: ManagedEntry[] = [];

      entries.forEach((entry, i) => {
        const isSelected = entry.satellite.noradId === selectedId;
        const scale      = isSelected ? SELECTED_SATELLITE_SCALE : 1.0;
        const matrix     = composeMatrix(entry.position, scale);

        mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(
          i,
          isSelected
            ? this.selectedColor
            : new Color(SATELLITE_TYPE_COLORS[type] as number),
        );
        managed.push({ satellite: entry.satellite, instanceIndex: i });
      });

      this.typeIndexMap.set(type, managed);
      mesh.count = entries.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Map a raycaster intersection back to a Satellite record.
   *
   * @param intersection  THREE.Raycaster intersection result against an InstancedMesh.
   * @returns             The corresponding Satellite, or null if not found.
   */
  getSelectedSatelliteFromIntersection(
    intersection: Intersection,
  ): Satellite | null {
    const type = intersection.object.userData.type as SatelliteType | undefined;
    if (!type) return null;
    const instanceId = intersection.instanceId;
    if (instanceId === undefined) return null;
    return this.typeIndexMap.get(type)?.[instanceId]?.satellite ?? null;
  }

  /** Return the internal mesh map (for raycasting). */
  getMeshes(): Map<SatelliteType, InstancedMesh> {
    return this.meshes;
  }

  /**
   * Dispose all GPU resources.  Must be called on component unmount.
   */
  dispose(): void {
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
    this.meshes.clear();
    this.typeIndexMap.clear();
  }
}
