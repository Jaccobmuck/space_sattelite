import { useQuery } from '@tanstack/react-query';
import type { SpaceWeather } from '../types';
import api from '../lib/api';
import { AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';
import { UpgradeRequiredError } from '../lib/errors';

export { UpgradeRequiredError } from '../lib/errors';

interface SpaceWeatherResponse extends SpaceWeather {
  timestamp: string;
}

export class AuthRequiredError extends Error {
  constructor(feature: string) {
    super(`${feature} requires authentication`);
    this.name = 'AuthRequiredError';
  }
}

async function fetchSpaceWeather(): Promise<SpaceWeatherResponse> {
  try {
    const { data } = await api.get<SpaceWeatherResponse>('/api/weather/space');
    return data;
  } catch (err) {
    if (err instanceof AxiosError) {
      // 401 = not authenticated, 403 = authenticated but wrong plan
      if (err.response?.status === 401) {
        throw new AuthRequiredError('Space Weather');
      }
      if (err.response?.status === 403) {
        throw new UpgradeRequiredError('Space Weather');
      }
    }
    throw new Error('Failed to fetch space weather data');
  }
}

export function useSpaceWeather() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = !!user;
  const isPro = user?.plan === 'pro';

  return useQuery({
    queryKey: ['spaceWeather', isPro],
    queryFn: () => {
      if (!isAuthenticated) {
        throw new AuthRequiredError('Space Weather');
      }
      if (!isPro) {
        throw new UpgradeRequiredError('Space Weather');
      }
      return fetchSpaceWeather();
    },
    refetchInterval: isPro ? 15 * 60 * 1000 : false,
    staleTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof AuthRequiredError) return false;
      if (error instanceof UpgradeRequiredError) return false;
      return failureCount < 2;
    },
  });
}
