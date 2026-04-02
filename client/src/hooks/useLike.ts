import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface LikeResponse {
  liked: boolean;
  like_count: number;
}

export function useLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sightingId: string) => {
      const { data } = await api.post<LikeResponse>(
        `/api/community/sightings/${sightingId}/like`
      );
      return { sightingId, ...data };
    },
    onSuccess: ({ sightingId }) => {
      queryClient.invalidateQueries({ queryKey: ['community', 'sighting', sightingId] });
      queryClient.invalidateQueries({ queryKey: ['community', 'feed'] });
    },
  });
}
