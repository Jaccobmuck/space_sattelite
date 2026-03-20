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

async function fetchSpaceWeather(): Promise<SpaceWeatherResponse> {
  try {
    const { data } = await api.get<SpaceWeatherResponse>('/api/weather/space');
    return data;
  } catch (err) {
    if (err instanceof AxiosError && (err.response?.status === 403 || err.response?.status === 401)) {
      throw new UpgradeRequiredError('Space Weather');
    }
    throw new Error('Failed to fetch space weather data');
  }
}

export function useSpaceWeather() {
  const user = useAuthStore((s) => s.user);
  const isPro = user?.plan === 'pro';

  return useQuery({
    queryKey: ['spaceWeather', isPro],
    queryFn: () => {
      if (!isPro) {
        throw new UpgradeRequiredError('Space Weather');
      }
      return fetchSpaceWeather();
    },
    refetchInterval: isPro ? 15 * 60 * 1000 : false,
    staleTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof UpgradeRequiredError) return false;
      return failureCount < 2;
    },
  });
}
