import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/appStore';
import type { Pass } from '../types';

interface PassesResponse {
  observer: { lat: number; lng: number };
  count: number;
  passes: Pass[];
  timestamp: string;
}

async function fetchPasses(
  lat: number,
  lng: number,
  noradId?: number
): Promise<PassesResponse> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
  });

  if (noradId !== undefined) {
    params.set('noradId', noradId.toString());
  }

  const response = await fetch(`/api/passes?${params}`);

  if (!response.ok) {
    throw new Error('Failed to fetch pass predictions');
  }

  return response.json();
}

export function usePasses(noradId?: number) {
  const userLocation = useAppStore((state) => state.userLocation);

  return useQuery({
    queryKey: ['passes', userLocation?.lat, userLocation?.lng, noradId],
    queryFn: () => {
      if (!userLocation) {
        throw new Error('Location required for pass predictions');
      }
      return fetchPasses(userLocation.lat, userLocation.lng, noradId);
    },
    enabled: !!userLocation,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
}
