import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import * as satellite from 'satellite.js';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import type { Satellite } from '../types';
import api from '../lib/api';

interface SatellitesResponse {
  count: number;
  timestamp: string;
  satellites: Satellite[];
}

async function fetchSatellites(): Promise<SatellitesResponse> {
  const { data } = await api.get<SatellitesResponse>('/api/satellites');
  return data;
}

// Simple FNV-1a hash for efficient TLE change detection
function hashTLEData(satellites: Satellite[]): number {
  let hash = 2166136261; // FNV offset basis
  for (const sat of satellites) {
    const str = sat.tle1 + sat.tle2;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619); // FNV prime
    }
  }
  return hash >>> 0; // Convert to unsigned 32-bit
}

export function useSatellites() {
  const setSatellites = useAppStore((state) => state.setSatellites);
  const setSatrecMap = useAppStore((state) => state.setSatrecMap);
  const setLoading = useAppStore((state) => state.setLoading);
  const setError = useAppStore((state) => state.setError);
  const plan = useAuthStore((s) => s.user?.plan ?? 'free');
  const lastTleHashRef = useRef<number>(0);

  const query = useQuery({
    queryKey: ['satellites', plan],
    queryFn: fetchSatellites,
    refetchInterval: 120000,
    staleTime: 60000,
  });

  useEffect(() => {
    if (query.data) {
      const satellites = query.data.satellites;
      setSatellites(satellites);

      // Use FNV-1a hash for efficient TLE change detection instead of concatenating all strings
      const tleHash = hashTLEData(satellites);
      if (tleHash !== lastTleHashRef.current) {
        lastTleHashRef.current = tleHash;

        // Parse TLEs into satrec objects
        const newSatrecMap = new Map<number, satellite.SatRec>();
        satellites.forEach((sat) => {
          if (sat.tle1 && sat.tle2) {
            try {
              const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
              if (satrec.error === 0) {
                newSatrecMap.set(sat.noradId, satrec);
              }
            } catch {
              // Skip satellites with invalid TLEs
            }
          }
        });
        setSatrecMap(newSatrecMap);
      }
    }
  }, [query.data, setSatellites, setSatrecMap]);

  useEffect(() => {
    setLoading(query.isLoading);
  }, [query.isLoading, setLoading]);

  useEffect(() => {
    if (query.error) {
      setError(query.error.message);
    } else {
      setError(null);
    }
  }, [query.error, setError]);

  return query;
}
