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

export function useSatellites() {
  const setSatellites = useAppStore((state) => state.setSatellites);
  const setSatrecMap = useAppStore((state) => state.setSatrecMap);
  const setLoading = useAppStore((state) => state.setLoading);
  const setError = useAppStore((state) => state.setError);
  const plan = useAuthStore((s) => s.user?.plan ?? 'free');
  const lastTleHashRef = useRef<string>('');

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

      // Create a hash of TLE data to detect changes
      const tleHash = satellites.map(s => s.tle1 + s.tle2).join('');
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
