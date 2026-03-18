import { memo, useEffect, useMemo, useRef } from 'react';
import { Line } from '@react-three/drei';
import { useAppStore } from '../../store/appStore';
import { computeGroundTrack, latLngAltToCartesian, generateFootprintCircle, latLngToCartesian } from '../../utils/orbital';
import type { GroundTrackPoint } from '../../types';
import {
  BufferGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  DoubleSide,
  LineBasicMaterial,
  LineLoop,
  Mesh,
} from 'three';
import { useFrame } from '@react-three/fiber';

const EARTH_RADIUS = 1;
const TRACK_ALTITUDE_OFFSET = 5;
const FOOTPRINT_ALTITUDE_OFFSET = 2;

interface TrackLineProps {
  points: GroundTrackPoint[];
  color: string;
  opacity: number;
  lineWidth?: number;
}

function TrackLine({ points, color, opacity, lineWidth = 1.5 }: TrackLineProps) {
  const positions = useMemo(() => {
    if (points.length < 2) return [];

    const result: [number, number, number][] = [];
    let prevLng: number | null = null;

    for (const point of points) {
      if (prevLng !== null && Math.abs(point.lng - prevLng) > 180) {
        result.push([NaN, NaN, NaN]);
      }
      prevLng = point.lng;

      const pos = latLngAltToCartesian(
        point.lat,
        point.lng,
        TRACK_ALTITUDE_OFFSET,
        EARTH_RADIUS
      );
      result.push([pos.x, pos.y, pos.z]);
    }

    return result;
  }, [points]);

  if (positions.length < 2) return null;

  return (
    <Line
      points={positions}
      color={color}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
    />
  );
}

interface PinnedFootprintProps {
  lat: number;
  lng: number;
  alt: number;
  color: string;
}

function PinnedFootprint({ lat, lng, alt, color }: PinnedFootprintProps) {
  const fillMeshRef = useRef<Mesh>(null);
  const outlineMeshRef = useRef<LineLoop>(null);

  const fillGeometry = useMemo(() => new BufferGeometry(), []);
  const outlineGeometry = useMemo(() => new BufferGeometry(), []);

  const fillMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.1,
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
        opacity: 0.5,
        linewidth: 2,
      }),
    [color]
  );

  useFrame(() => {
    const footprintPoints = generateFootprintCircle(lat, lng, alt, 64);
    if (footprintPoints.length < 3) return;

    const outlinePositions: number[] = [];
    footprintPoints.forEach((point) => {
      const pos = latLngToCartesian(
        point.lat,
        point.lng,
        EARTH_RADIUS + FOOTPRINT_ALTITUDE_OFFSET / 6371
      );
      outlinePositions.push(pos.x, pos.y, pos.z);
    });

    const centerPos = latLngToCartesian(lat, lng, EARTH_RADIUS + FOOTPRINT_ALTITUDE_OFFSET / 6371);
    const fillVertices: number[] = [];
    for (let i = 0; i < footprintPoints.length - 1; i++) {
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

    const fillPositionAttr = fillGeometry.getAttribute('position');
    if (fillPositionAttr && fillPositionAttr.count === fillVertices.length / 3) {
      const arr = fillPositionAttr.array as Float32Array;
      for (let i = 0; i < fillVertices.length; i++) {
        arr[i] = fillVertices[i];
      }
      fillPositionAttr.needsUpdate = true;
    } else {
      fillGeometry.setAttribute('position', new Float32BufferAttribute(fillVertices, 3));
    }

    const outlinePositionAttr = outlineGeometry.getAttribute('position');
    if (outlinePositionAttr && outlinePositionAttr.count === outlinePositions.length / 3) {
      const arr = outlinePositionAttr.array as Float32Array;
      for (let i = 0; i < outlinePositions.length; i++) {
        arr[i] = outlinePositions[i];
      }
      outlinePositionAttr.needsUpdate = true;
    } else {
      outlineGeometry.setAttribute('position', new Float32BufferAttribute(outlinePositions, 3));
    }
  });

  useEffect(() => {
    return () => {
      fillGeometry.dispose();
      outlineGeometry.dispose();
      fillMaterial.dispose();
      outlineMaterial.dispose();
    };
  }, [fillGeometry, outlineGeometry, fillMaterial, outlineMaterial]);

  return (
    <group>
      <mesh ref={fillMeshRef} geometry={fillGeometry} material={fillMaterial} />
      <lineLoop ref={outlineMeshRef} geometry={outlineGeometry} material={outlineMaterial} />
    </group>
  );
}

function PinnedSatelliteTracks() {
  const { pinnedSatellites, updatePinnedGroundTrack, simulatedTime, timeMultiplier } = useAppStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compute ground tracks for pinned satellites
  useEffect(() => {
    if (pinnedSatellites.length === 0) return;

    const computeTracks = () => {
      pinnedSatellites.forEach((pinned) => {
        if (!pinned.satellite.tle1 || !pinned.satellite.tle2) return;

        const track = computeGroundTrack(
          pinned.satellite.tle1,
          pinned.satellite.tle2,
          simulatedTime,
          pinned.satellite.period || 90,
          60
        );
        updatePinnedGroundTrack(pinned.satellite.noradId, track);
      });
    };

    computeTracks();

    const refreshInterval = timeMultiplier > 1 ? 1000 : 60000;
    intervalRef.current = setInterval(computeTracks, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pinnedSatellites, updatePinnedGroundTrack, simulatedTime, timeMultiplier]);

  if (pinnedSatellites.length === 0) return null;

  return (
    <group>
      {pinnedSatellites.map((pinned) => (
        <group key={pinned.satellite.noradId}>
          {/* Ground track */}
          {pinned.groundTrack && (
            <>
              <TrackLine
                points={pinned.groundTrack.past}
                color={pinned.color}
                opacity={0.3}
                lineWidth={1}
              />
              <TrackLine
                points={pinned.groundTrack.future}
                color={pinned.color}
                opacity={0.7}
                lineWidth={2}
              />
            </>
          )}
          {/* Coverage footprint */}
          <PinnedFootprint
            lat={pinned.satellite.lat}
            lng={pinned.satellite.lng}
            alt={pinned.satellite.alt}
            color={pinned.color}
          />
        </group>
      ))}
    </group>
  );
}

export default memo(PinnedSatelliteTracks);
