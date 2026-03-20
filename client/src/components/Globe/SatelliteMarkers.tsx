import { memo, useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  Object3D,
  Color,
  SphereGeometry,
  MeshBasicMaterial,
} from 'three';
import * as satellite from 'satellite.js';
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
  const lastPanelUpdateRef = useRef<number>(0);
  const { satellites, selectSatellite, selectedSatellite, searchHighlightId, satrecMap, simulatedTime, updateSelectedSatellitePosition } = useAppStore();
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

  useFrame((state) => {
    if (!meshRef.current || satellites.length === 0) return;

    const time = state.clock.getElapsedTime();
    const now = Date.now();
    const shouldUpdatePanel = now - lastPanelUpdateRef.current > 1000;

    satellites.forEach((sat, i) => {
      let lat = sat.lat;
      let lng = sat.lng;
      let alt = sat.alt;
      let velocity = sat.velocity;

      // Propagate position using SGP4 if satrec is available
      const satrec = satrecMap.get(sat.noradId);
      if (satrec) {
        try {
          const posVel = satellite.propagate(satrec, simulatedTime);
          
          // Check if propagation succeeded (returns false for decayed/invalid satellites)
          if (posVel.position !== false && typeof posVel.position !== 'boolean') {
            const posEci = posVel.position;
            const gmst = satellite.gstime(simulatedTime);
            const geodetic = satellite.eciToGeodetic(posEci, gmst);
            
            lat = satellite.degreesLat(geodetic.latitude);
            lng = satellite.degreesLong(geodetic.longitude);
            alt = geodetic.height;

            // Calculate velocity if available
            if (posVel.velocity !== false && typeof posVel.velocity !== 'boolean') {
              const velEci = posVel.velocity;
              velocity = Math.sqrt(velEci.x ** 2 + velEci.y ** 2 + velEci.z ** 2);
            }
          }
        } catch {
          // Propagation failed, use stored position
        }
      }

      const pos = latLngToVector3(lat, lng, alt);
      dummy.position.set(pos.x, pos.y, pos.z);

      let scale = sat.category === 'iss' ? 3 : 1;
      if (selectedSatellite?.noradId === sat.noradId) {
        scale *= 1.5;

        // Update selected satellite position in Zustand (throttled to 1/sec)
        if (shouldUpdatePanel) {
          updateSelectedSatellitePosition(lat, lng, alt, velocity);
        }
      }
      // Pulsing effect for search highlight
      if (searchHighlightId === sat.noradId) {
        scale *= 1.5 + 0.3 * Math.sin(time * 5);
      }
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();

      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Change color for highlighted satellite
      if (searchHighlightId === sat.noradId) {
        meshRef.current!.setColorAt(i, new Color('#ffffff'));
      } else {
        meshRef.current!.setColorAt(i, new Color(CATEGORY_COLORS[sat.category]));
      }
    });

    if (shouldUpdatePanel) {
      lastPanelUpdateRef.current = now;
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
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
