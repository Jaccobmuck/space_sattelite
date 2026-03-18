import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/appStore';
import type { Pass } from '../types';

interface ISSResponse {
  noradId: number;
  name: string;
  position: {
    lat: number;
    lng: number;
    alt: number;
    velocity: number;
  } | null;
  crew: Array<{
    name: string;
    agency: string;
    role: string;
    daysInSpace: number;
  }>;
  groundTrack: Array<{ lat: number; lng: number }>;
  passes: Pass[];
  timestamp: string;
}

async function fetchISS(lat?: number, lng?: number): Promise<ISSResponse> {
  const params = new URLSearchParams();
  if (lat !== undefined) params.set('lat', lat.toString());
  if (lng !== undefined) params.set('lng', lng.toString());

  const url = `/api/iss${params.toString() ? `?${params}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch ISS data');
  }

  return response.json();
}

export function useISS() {
  const userLocation = useAppStore((state) => state.userLocation);

  return useQuery({
    queryKey: ['iss', userLocation?.lat, userLocation?.lng],
    queryFn: () => fetchISS(userLocation?.lat, userLocation?.lng),
    refetchInterval: 5000,
    staleTime: 3000,
  });
}
