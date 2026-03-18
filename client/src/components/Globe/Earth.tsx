import { memo, useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, ShaderMaterial, Vector3 } from 'three';
import type { Mesh, DirectionalLight } from 'three';

function getSunPosition(date: Date): Vector3 {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  
  const sunLng = -((hour / 24) * 360 - 180);
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

const earthVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const earthFragmentShader = `
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform vec3 sunDirection;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  void main() {
    vec3 dayColor = texture2D(dayTexture, vUv).rgb;
    vec3 nightColor = texture2D(nightTexture, vUv).rgb;
    
    vec3 normal = normalize(vNormal);
    float sunDot = dot(normal, normalize(sunDirection));
    
    // Smooth transition from night to day
    float dayNightMix = smoothstep(-0.15, 0.25, sunDot);
    
    // Enhance city lights - boost brightness and add warm glow
    float lightIntensity = length(nightColor);
    vec3 cityLights = nightColor * 2.5;
    // Add warm orange/yellow tint to city lights
    cityLights += vec3(0.4, 0.25, 0.1) * lightIntensity * 1.5;
    
    // Dark base for night side (ocean/land without lights)
    vec3 nightBase = vec3(0.02, 0.03, 0.05);
    vec3 nightSide = nightBase + cityLights;
    
    // Apply day lighting
    float diffuse = max(0.0, sunDot);
    vec3 daySide = dayColor * (0.3 + 0.7 * diffuse);
    
    // Mix day and night
    vec3 color = mix(nightSide, daySide, dayNightMix);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

function Earth() {
  const meshRef = useRef<Mesh>(null);
  const cloudsRef = useRef<Mesh>(null);
  const sunRef = useRef<DirectionalLight>(null);
  
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
    const now = new Date();
    const sunPos = getSunPosition(now);
    
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
