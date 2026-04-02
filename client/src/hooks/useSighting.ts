import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { CommunitySighting } from '../types';

export function useSighting(id: string | null) {
  return useQuery({
    queryKey: ['community', 'sighting', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get<{ sighting: CommunitySighting }>(
        `/api/community/sightings/${id}`
      );
      return data.sighting;
    },
    enabled: !!id,
  });
}
