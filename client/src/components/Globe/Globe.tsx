import { memo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import Earth from './Earth';
import Atmosphere from './Atmosphere';
import Stars from './Stars';
import SatelliteMarkers from './SatelliteMarkers';
import Moon from './Moon';
import UserLocationMarker from './UserLocationMarker';

function Globe() {
  return (
    <div className="absolute inset-0">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 3]} fov={45} />
        <OrbitControls
          enablePan={false}
          minDistance={1.5}
          maxDistance={6}
          enableDamping
          dampingFactor={0.05}
        />
        <ambientLight intensity={0.1} />
        <directionalLight position={[5, 3, 5]} intensity={1.5} />
        <Suspense fallback={null}>
          <Earth />
          <Atmosphere />
          <Stars />
          <SatelliteMarkers />
          <UserLocationMarker />
          <Moon />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default memo(Globe);
