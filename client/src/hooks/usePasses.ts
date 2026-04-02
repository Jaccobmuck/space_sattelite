import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/appStore';
import type { Pass } from '../types';
import api from '../lib/api';
import { AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';
import { UpgradeRequiredError } from '../lib/errors';

export { UpgradeRequiredError } from '../lib/errors';

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

  try {
    const { data } = await api.get<PassesResponse>(`/api/passes?${params}`);
    return data;
  } catch (err) {
    if (err instanceof AxiosError) {
      if (err.response?.status === 401) {
        // Unauthenticated - not an upsell opportunity
        throw new Error('Authentication required. Please log in.');
      }
      if (err.response?.status === 403) {
        // Plan gating - show upgrade prompt
        throw new UpgradeRequiredError('Pass Predictions');
      }
    }
    throw new Error('Failed to fetch pass predictions');
  }
}

export function usePasses(noradId?: number) {
  const userLocation = useAppStore((state) => state.userLocation);
  const user = useAuthStore((s) => s.user);
  const isPro = user?.plan === 'pro';

  return useQuery({
    queryKey: ['passes', userLocation?.lat, userLocation?.lng, noradId, isPro],
    queryFn: () => {
      if (!isPro) {
        throw new UpgradeRequiredError('Pass Predictions');
      }
      if (!userLocation) {
        throw new Error('Location required for pass predictions');
      }
      return fetchPasses(userLocation.lat, userLocation.lng, noradId);
    },
    enabled: !isPro || !!userLocation,
    refetchInterval: isPro ? 5 * 60 * 1000 : false,
    staleTime: 2 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof UpgradeRequiredError) return false;
      return failureCount < 2;
    },
  });
}
