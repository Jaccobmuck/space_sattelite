import { memo, useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, ShaderMaterial, Vector3 } from 'three';
import type { Mesh, DirectionalLight } from 'three';
import { earthVertexShader, earthFragmentShader } from './shaders/earthShader';
import { useAppStore } from '../../store/appStore';

function getSunPosition(date: Date): Vector3 {
  // Calculate based on time of day and Earth's axial tilt
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  
  // Sun longitude based on UTC time
  const sunLng = -((hour / 24) * 360 - 180);
  // Sun declination (latitude) based on day of year - using astronomical formula
  const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81)) * (Math.PI / 180));
  
  const phi = (90 - declination) * (Math.PI / 180);
  const theta = (sunLng + 180) * (Math.PI / 180);
  const distance = 10;
  
  return new Vector3(
    -distance * Math.sin(phi) * Math.cos(theta),
    distance * Math.cos(phi),
    distance * Math.sin(phi) * Math.sin(theta)
  );
}

function Earth() {
  const meshRef = useRef<Mesh>(null);
  const cloudsRef = useRef<Mesh>(null);
  const sunRef = useRef<DirectionalLight>(null);
  const simulatedTime = useAppStore((state) => state.simulatedTime);
  
  const [dayTexture, nightTexture, cloudsTexture] = useLoader(TextureLoader, [
    '/textures/earth_day.jpg',
    '/textures/earth_night.jpg',
    '/textures/earth_clouds.png',
  ]);

  const earthMaterial = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayTexture },
        nightTexture: { value: nightTexture },
        sunDirection: { value: new Vector3(1, 0, 0) },
      },
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader,
    });
  }, [dayTexture, nightTexture]);

  useFrame(() => {
    const sunPos = getSunPosition(simulatedTime);
    
    if (earthMaterial.uniforms) {
      earthMaterial.uniforms.sunDirection.value.copy(sunPos).normalize();
    }
    
    if (sunRef.current) {
      sunRef.current.position.copy(sunPos);
    }
    
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += 0.0002;
    }
  });

  const initialSunPos = getSunPosition(new Date());

  return (
    <group>
      <directionalLight
        ref={sunRef}
        position={[initialSunPos.x, initialSunPos.y, initialSunPos.z]}
        intensity={2}
        color="#fffaf0"
      />
      <mesh ref={meshRef} material={earthMaterial}>
        <sphereGeometry args={[1, 64, 64]} />
      </mesh>
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[1.01, 64, 64]} />
        <meshStandardMaterial
          map={cloudsTexture}
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default memo(Earth);
