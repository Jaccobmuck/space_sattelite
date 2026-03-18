import { memo, useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  Object3D,
  Color,
  SphereGeometry,
  MeshBasicMaterial,
} from 'three';
import { useAppStore } from '../../store/appStore';
import type { SatelliteCategory } from '../../types';

const CATEGORY_COLORS: Record<SatelliteCategory, string> = {
  weather: '#38bdf8',
  comm: '#fb923c',
  nav: '#4ade80',
  iss: '#f87171',
  science: '#22d3ee',
  debris: '#64748b',
};

const EARTH_RADIUS = 1;

function latLngToVector3(lat: number, lng: number, alt: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const radius = EARTH_RADIUS + alt / 6371;

  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

function SatelliteMarkers() {
  const meshRef = useRef<InstancedMesh>(null);
  const { satellites, selectSatellite, selectedSatellite } = useAppStore();
  const dummy = useMemo(() => new Object3D(), []);

  const geometry = useMemo(() => new SphereGeometry(0.008, 8, 8), []);
  const material = useMemo(
    () => new MeshBasicMaterial({ color: '#ffffff' }),
    []
  );

  useEffect(() => {
    if (!meshRef.current || satellites.length === 0) return;

    satellites.forEach((sat, i) => {
      const pos = latLngToVector3(sat.lat, sat.lng, sat.alt);
      dummy.position.set(pos.x, pos.y, pos.z);

      const scale = sat.category === 'iss' ? 3 : 1;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();

      meshRef.current!.setMatrixAt(i, dummy.matrix);
      meshRef.current!.setColorAt(
        i,
        new Color(CATEGORY_COLORS[sat.category])
      );
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [satellites, dummy]);

  useFrame(() => {
    if (!meshRef.current || satellites.length === 0) return;

    satellites.forEach((sat, i) => {
      const pos = latLngToVector3(sat.lat, sat.lng, sat.alt);
      dummy.position.set(pos.x, pos.y, pos.z);

      let scale = sat.category === 'iss' ? 3 : 1;
      if (selectedSatellite?.noradId === sat.noradId) {
        scale *= 1.5;
      }
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();

      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const handleClick = (event: { instanceId?: number }) => {
    if (event.instanceId !== undefined && satellites[event.instanceId]) {
      selectSatellite(satellites[event.instanceId]);
    }
  };

  if (satellites.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, satellites.length]}
      onClick={handleClick}
    />
  );
}

export default memo(SatelliteMarkers);
