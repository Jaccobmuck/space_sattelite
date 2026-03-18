import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/appStore';
import type { MoonData } from '../types';

interface MoonResponse extends MoonData {
  timestamp: string;
}

async function fetchMoonPhase(lat?: number, lng?: number): Promise<MoonResponse> {
  const params = new URLSearchParams();
  if (lat !== undefined) params.set('lat', lat.toString());
  if (lng !== undefined) params.set('lng', lng.toString());

  const url = `/api/moon${params.toString() ? `?${params}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch moon data');
  }

  return response.json();
}

export function useMoonPhase() {
  const userLocation = useAppStore((state) => state.userLocation);

  return useQuery({
    queryKey: ['moon', userLocation?.lat, userLocation?.lng],
    queryFn: () => fetchMoonPhase(userLocation?.lat, userLocation?.lng),
    refetchInterval: 60 * 60 * 1000,
    staleTime: 30 * 60 * 1000,
  });
}
