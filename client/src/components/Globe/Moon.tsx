import { memo, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, SphereGeometry, MeshStandardMaterial, Color } from 'three';

const MOON_DISTANCE = 3.5;
const MOON_RADIUS = 0.27;

function getMoonPosition(date: Date) {
  const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
  const daysSinceJ2000 = (date.getTime() - J2000) / (1000 * 60 * 60 * 24);
  
  const meanLongitude = (218.316 + 13.176396 * daysSinceJ2000) % 360;
  const meanAnomaly = (134.963 + 13.064993 * daysSinceJ2000) % 360;
  const F = (93.272 + 13.229350 * daysSinceJ2000) % 360;
  
  const longitude = meanLongitude + 
    6.289 * Math.sin(meanAnomaly * Math.PI / 180) +
    1.274 * Math.sin((2 * meanLongitude - meanAnomaly) * Math.PI / 180);
  
  const latitude = 5.128 * Math.sin(F * Math.PI / 180);
  
  const phi = (90 - latitude) * (Math.PI / 180);
  const theta = (longitude + 180) * (Math.PI / 180);
  
  return {
    x: -MOON_DISTANCE * Math.sin(phi) * Math.cos(theta),
    y: MOON_DISTANCE * Math.cos(phi),
    z: MOON_DISTANCE * Math.sin(phi) * Math.sin(theta),
  };
}

function Moon() {
  const meshRef = useRef<Mesh>(null);
  const glowRef = useRef<Mesh>(null);
  
  const geometry = useMemo(() => new SphereGeometry(MOON_RADIUS, 32, 32), []);
  const material = useMemo(() => new MeshStandardMaterial({
    color: new Color('#e8e8e8'),
    roughness: 0.9,
    metalness: 0.1,
    emissive: new Color('#404040'),
    emissiveIntensity: 0.1,
  }), []);

  useFrame(() => {
    if (meshRef.current) {
      const pos = getMoonPosition(new Date());
      meshRef.current.position.set(pos.x, pos.y, pos.z);
      meshRef.current.rotation.y += 0.001;
    }
    if (glowRef.current && meshRef.current) {
      glowRef.current.position.copy(meshRef.current.position);
    }
  });

  const initialPos = getMoonPosition(new Date());

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        position={[initialPos.x, initialPos.y, initialPos.z]}
      />
      <mesh
        ref={glowRef}
        position={[initialPos.x, initialPos.y, initialPos.z]}
      >
        <sphereGeometry args={[MOON_RADIUS * 1.15, 32, 32]} />
        <meshBasicMaterial
          color="#a0a0a0"
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default memo(Moon);
