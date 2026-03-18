import { memo, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Line } from 'three';

interface OrbitTrailProps {
  positions: { lat: number; lng: number; alt: number }[];
  color?: string;
}

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

function OrbitTrail({ positions, color = '#38bdf8' }: OrbitTrailProps) {
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    const vertices: number[] = [];

    positions.forEach((pos) => {
      const vec = latLngToVector3(pos.lat, pos.lng, pos.alt);
      vertices.push(vec.x, vec.y, vec.z);
    });

    geo.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    return geo;
  }, [positions]);

  const material = useMemo(() => {
    return new LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
    });
  }, [color]);

  const line = useMemo(() => {
    return new Line(geometry, material);
  }, [geometry, material]);

  if (positions.length < 2) {
    return null;
  }

  return <primitive object={line} />;
}

export default memo(OrbitTrail);
