import { useQuery } from '@tanstack/react-query';
import type { SpaceWeather } from '../types';

interface SpaceWeatherResponse extends SpaceWeather {
  timestamp: string;
}

async function fetchSpaceWeather(): Promise<SpaceWeatherResponse> {
  const response = await fetch('/api/weather/space');

  if (!response.ok) {
    throw new Error('Failed to fetch space weather data');
  }

  return response.json();
}

export function useSpaceWeather() {
  return useQuery({
    queryKey: ['spaceWeather'],
    queryFn: fetchSpaceWeather,
    refetchInterval: 15 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  });
}
