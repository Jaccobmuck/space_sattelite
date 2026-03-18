import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';
import { useAppStore } from '../../store/appStore';

const EARTH_RADIUS = 1;

function latLngToVector3(lat: number, lng: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const radius = EARTH_RADIUS + 0.005;

  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

function UserLocationMarker() {
  const userLocation = useAppStore((state) => state.userLocation);
  const ringRef = useRef<Mesh>(null);
  const pulseRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 3) * 0.15;
      ringRef.current.scale.setScalar(scale);
    }
    if (pulseRef.current) {
      const opacity = 0.4 + Math.sin(clock.elapsedTime * 2) * 0.2;
      const material = pulseRef.current.material as THREE.MeshBasicMaterial;
      if (material.opacity !== undefined) {
        material.opacity = opacity;
      }
      const scale = 1 + Math.sin(clock.elapsedTime * 1.5) * 0.3;
      pulseRef.current.scale.setScalar(scale);
    }
  });

  if (!userLocation) return null;

  const pos = latLngToVector3(userLocation.lat, userLocation.lng);

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <mesh>
        <sphereGeometry args={[0.015, 16, 16]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      
      <mesh ref={ringRef}>
        <ringGeometry args={[0.02, 0.025, 32]} />
        <meshBasicMaterial 
          color="#ef4444" 
          transparent 
          opacity={0.8}
          side={2}
        />
      </mesh>
      
      <mesh ref={pulseRef}>
        <ringGeometry args={[0.03, 0.035, 32]} />
        <meshBasicMaterial 
          color="#ef4444" 
          transparent 
          opacity={0.4}
          side={2}
        />
      </mesh>

      <mesh position={[0, 0.04, 0]}>
        <coneGeometry args={[0.008, 0.025, 8]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

export default memo(UserLocationMarker);
