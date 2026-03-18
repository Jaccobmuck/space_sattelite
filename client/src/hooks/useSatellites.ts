import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import type { Satellite } from '../types';

interface SatellitesResponse {
  count: number;
  timestamp: string;
  satellites: Satellite[];
}

async function fetchSatellites(): Promise<SatellitesResponse> {
  const response = await fetch('/api/satellites');
  if (!response.ok) {
    throw new Error('Failed to fetch satellites');
  }
  return response.json();
}

export function useSatellites() {
  const setSatellites = useAppStore((state) => state.setSatellites);
  const setLoading = useAppStore((state) => state.setLoading);
  const setError = useAppStore((state) => state.setError);

  const query = useQuery({
    queryKey: ['satellites'],
    queryFn: fetchSatellites,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  useEffect(() => {
    if (query.data) {
      setSatellites(query.data.satellites);
    }
  }, [query.data, setSatellites]);

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
