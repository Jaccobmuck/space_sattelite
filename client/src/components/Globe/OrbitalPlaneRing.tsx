import { memo, useMemo, useEffect, useRef } from 'react';
import {
  TorusGeometry,
  MeshBasicMaterial,
  Mesh,
  Euler,
  DoubleSide,
} from 'three';
import { useAppStore } from '../../store/appStore';
import { getOrbitalElements } from '../../utils/orbital';

const EARTH_RADIUS = 1;

function OrbitalPlaneRing() {
  const { selectedSatellite } = useAppStore();
  const meshRef = useRef<Mesh>(null);

  const orbitalElements = useMemo(() => {
    if (!selectedSatellite?.tle1 || !selectedSatellite?.tle2) return null;
    return getOrbitalElements(selectedSatellite.tle1, selectedSatellite.tle2);
  }, [selectedSatellite?.tle1, selectedSatellite?.tle2]);

  // Calculate orbital radius based on satellite altitude
  const orbitRadius = useMemo(() => {
    if (!selectedSatellite) return EARTH_RADIUS + 0.1;
    return EARTH_RADIUS + selectedSatellite.alt / 6371;
  }, [selectedSatellite]);

  const geometry = useMemo(() => {
    // TorusGeometry(radius, tube, radialSegments, tubularSegments)
    // Very thin tube to make it look like a ring/circle
    return new TorusGeometry(orbitRadius, 0.002, 8, 128);
  }, [orbitRadius]);

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.15,
        side: DoubleSide,
        depthWrite: false,
      }),
    []
  );

  // Calculate rotation based on orbital elements
  const rotation = useMemo(() => {
    if (!orbitalElements) return new Euler(0, 0, 0);

    // Convert degrees to radians
    const inclinationRad = orbitalElements.inclination * (Math.PI / 180);
    const raanRad = orbitalElements.raan * (Math.PI / 180);
    const argOfPerigeeRad = orbitalElements.argOfPerigee * (Math.PI / 180);

    // The orbital plane orientation:
    // 1. Start with the ring in the XY plane (equatorial)
    // 2. Rotate by RAAN around Y axis (ascending node longitude)
    // 3. Rotate by inclination around the new X axis
    // 4. Rotate by argument of perigee around the new Z axis (optional for visualization)

    // For a torus lying flat, we need to rotate it to match the orbital plane
    // Torus default is in XY plane, we need to apply:
    // - X rotation = inclination (tilt from equator)
    // - Y rotation = RAAN (rotation around Earth's axis)
    // - Z rotation = argument of perigee (rotation within orbital plane)

    return new Euler(
      Math.PI / 2 - inclinationRad, // Tilt from equatorial plane
      raanRad, // Longitude of ascending node
      argOfPerigeeRad, // Argument of perigee
      'YXZ' // Rotation order
    );
  }, [orbitalElements]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  if (!selectedSatellite || !orbitalElements) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      rotation={rotation}
    />
  );
}

export default memo(OrbitalPlaneRing);
