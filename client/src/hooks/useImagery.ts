import { useState, useEffect, useCallback } from 'react';
import type { SatelliteImagery } from '../types';

const API_BASE = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || '';

export function useImagery(noradId: number | null, satelliteName: string | null) {
  const [data, setData] = useState<SatelliteImagery | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchImagery = useCallback(async () => {
    if (!noradId || !satelliteName) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/imagery/${noradId}?name=${encodeURIComponent(satelliteName)}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch imagery');
      }

      const imagery: SatelliteImagery = await response.json();
      setData(imagery);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [noradId, satelliteName]);

  useEffect(() => {
    fetchImagery();
  }, [fetchImagery]);

  return { data, isLoading, error, refetch: fetchImagery };
}

export function useHasImagery(noradId: number | null, satelliteName: string | null) {
  const [hasImagery, setHasImagery] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!noradId || !satelliteName) {
      setHasImagery(false);
      return;
    }

    const checkImagery = async () => {
      setIsChecking(true);
      try {
        const response = await fetch(
          `${API_BASE}/api/imagery/${noradId}/check?name=${encodeURIComponent(satelliteName)}`
        );

        if (response.ok) {
          const result = await response.json();
          setHasImagery(result.hasImagery);
        }
      } catch {
        setHasImagery(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkImagery();
  }, [noradId, satelliteName]);

  return { hasImagery, isChecking };
}
