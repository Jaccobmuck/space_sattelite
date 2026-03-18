import { memo, useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
  LineBasicMaterial,
  LineLoop,
} from 'three';
import { useAppStore } from '../../store/appStore';
import { generateFootprintCircle, latLngToCartesian } from '../../utils/orbital';

const EARTH_RADIUS = 1;
const FOOTPRINT_ALTITUDE_OFFSET = 2; // Slight offset above Earth surface

const CATEGORY_COLORS: Record<string, string> = {
  weather: '#38bdf8',
  comm: '#fb923c',
  nav: '#4ade80',
  iss: '#f87171',
  science: '#22d3ee',
  debris: '#64748b',
};

function CoverageFootprint() {
  const { selectedSatellite } = useAppStore();
  const fillMeshRef = useRef<Mesh>(null);
  const outlineMeshRef = useRef<LineLoop>(null);

  const fillGeometry = useMemo(() => new BufferGeometry(), []);
  const outlineGeometry = useMemo(() => new BufferGeometry(), []);

  const color = selectedSatellite
    ? CATEGORY_COLORS[selectedSatellite.category] || '#38bdf8'
    : '#38bdf8';

  const fillMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.15,
        side: DoubleSide,
        depthWrite: false,
      }),
    [color]
  );

  const outlineMaterial = useMemo(
    () =>
      new LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
        linewidth: 2,
      }),
    [color]
  );

  // Update geometry when satellite position changes
  useFrame(() => {
    if (!selectedSatellite) return;

    const footprintPoints = generateFootprintCircle(
      selectedSatellite.lat,
      selectedSatellite.lng,
      selectedSatellite.alt,
      64
    );

    if (footprintPoints.length < 3) return;

    // Convert to 3D positions
    const positions: number[] = [];
    const outlinePositions: number[] = [];

    footprintPoints.forEach((point) => {
      const pos = latLngToCartesian(
        point.lat,
        point.lng,
        EARTH_RADIUS + FOOTPRINT_ALTITUDE_OFFSET / 6371
      );
      positions.push(pos.x, pos.y, pos.z);
      outlinePositions.push(pos.x, pos.y, pos.z);
    });

    // Create triangulated fill geometry (fan from center)
    const centerPos = latLngToCartesian(
      selectedSatellite.lat,
      selectedSatellite.lng,
      EARTH_RADIUS + FOOTPRINT_ALTITUDE_OFFSET / 6371
    );

    const fillVertices: number[] = [];
    for (let i = 0; i < footprintPoints.length - 1; i++) {
      // Triangle: center, point i, point i+1
      fillVertices.push(centerPos.x, centerPos.y, centerPos.z);
      const p1 = latLngToCartesian(
        footprintPoints[i].lat,
        footprintPoints[i].lng,
        EARTH_RADIUS + FOOTPRINT_ALTITUDE_OFFSET / 6371
      );
      fillVertices.push(p1.x, p1.y, p1.z);
      const p2 = latLngToCartesian(
        footprintPoints[i + 1].lat,
        footprintPoints[i + 1].lng,
        EARTH_RADIUS + FOOTPRINT_ALTITUDE_OFFSET / 6371
      );
      fillVertices.push(p2.x, p2.y, p2.z);
    }

    // Update fill geometry
    const fillPositionAttr = fillGeometry.getAttribute('position');
    if (fillPositionAttr && fillPositionAttr.count === fillVertices.length / 3) {
      const arr = fillPositionAttr.array as Float32Array;
      for (let i = 0; i < fillVertices.length; i++) {
        arr[i] = fillVertices[i];
      }
      fillPositionAttr.needsUpdate = true;
    } else {
      fillGeometry.setAttribute(
        'position',
        new Float32BufferAttribute(fillVertices, 3)
      );
    }

    // Update outline geometry
    const outlinePositionAttr = outlineGeometry.getAttribute('position');
    if (outlinePositionAttr && outlinePositionAttr.count === outlinePositions.length / 3) {
      const arr = outlinePositionAttr.array as Float32Array;
      for (let i = 0; i < outlinePositions.length; i++) {
        arr[i] = outlinePositions[i];
      }
      outlinePositionAttr.needsUpdate = true;
    } else {
      outlineGeometry.setAttribute(
        'position',
        new Float32BufferAttribute(outlinePositions, 3)
      );
    }
  });

  // Cleanup geometries and materials on unmount
  useEffect(() => {
    return () => {
      fillGeometry.dispose();
      outlineGeometry.dispose();
      fillMaterial.dispose();
      outlineMaterial.dispose();
    };
  }, [fillGeometry, outlineGeometry, fillMaterial, outlineMaterial]);

  if (!selectedSatellite) return null;

  return (
    <group>
      <mesh ref={fillMeshRef} geometry={fillGeometry} material={fillMaterial} />
      <lineLoop ref={outlineMeshRef} geometry={outlineGeometry} material={outlineMaterial} />
    </group>
  );
}

export default memo(CoverageFootprint);
