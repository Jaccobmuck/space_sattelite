import { memo, useEffect, useMemo, useRef } from 'react';
import { Line } from '@react-three/drei';
import { useAppStore } from '../../store/appStore';
import { computeGroundTrack, latLngAltToCartesian } from '../../utils/orbital';
import type { GroundTrackPoint } from '../../types';

const EARTH_RADIUS = 1;
const TRACK_ALTITUDE_OFFSET = 5; // Slight offset above Earth surface for visibility

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
      // Detect longitude wrap-around (crossing ±180°)
      if (prevLng !== null && Math.abs(point.lng - prevLng) > 180) {
        // Add a break by inserting NaN (Line component handles this)
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

function GroundTrack() {
  const { selectedSatellite, groundTrack, setGroundTrack } = useAppStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const simulatedTime = useAppStore((state) => state.simulatedTime);
  const timeMultiplier = useAppStore((state) => state.timeMultiplier);

  // Compute ground track when satellite is selected or time changes significantly
  useEffect(() => {
    if (!selectedSatellite?.tle1 || !selectedSatellite?.tle2) {
      setGroundTrack(null);
      return;
    }

    const computeTrack = () => {
      const track = computeGroundTrack(
        selectedSatellite.tle1,
        selectedSatellite.tle2,
        simulatedTime,
        selectedSatellite.period || 90, // Use orbital period or default 90 min
        60 // Sample every 60 seconds
      );
      setGroundTrack(track);
    };

    // Compute immediately
    computeTrack();

    // Refresh based on time multiplier
    const refreshInterval = timeMultiplier > 1 ? 1000 : 60000;
    intervalRef.current = setInterval(computeTrack, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [selectedSatellite, setGroundTrack, simulatedTime, timeMultiplier]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  if (!groundTrack || !selectedSatellite) return null;

  // Get category color for the satellite
  const categoryColors: Record<string, string> = {
    weather: '#38bdf8',
    comm: '#fb923c',
    nav: '#4ade80',
    iss: '#f87171',
    science: '#22d3ee',
    debris: '#64748b',
  };

  const trackColor = categoryColors[selectedSatellite.category] || '#38bdf8';

  return (
    <group>
      {/* Past track - dimmer */}
      <TrackLine
        points={groundTrack.past}
        color={trackColor}
        opacity={0.3}
        lineWidth={1}
      />
      {/* Future track - brighter */}
      <TrackLine
        points={groundTrack.future}
        color={trackColor}
        opacity={0.8}
        lineWidth={2}
      />
    </group>
  );
}

export default memo(GroundTrack);
