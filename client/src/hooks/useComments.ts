import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { CommunityComment } from '../types';

interface CommentsResponse {
  comments: CommunityComment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export function useComments(sightingId: string | null) {
  return useQuery({
    queryKey: ['community', 'comments', sightingId],
    queryFn: async () => {
      if (!sightingId) return { comments: [], pagination: { page: 1, limit: 50, total: 0, hasMore: false } };
      const { data } = await api.get<CommentsResponse>(
        `/api/community/sightings/${sightingId}/comments`
      );
      return data;
    },
    enabled: !!sightingId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sightingId, text }: { sightingId: string; text: string }) => {
      const { data } = await api.post<{ comment: CommunityComment }>(
        `/api/community/sightings/${sightingId}/comments`,
        { text }
      );
      return data.comment;
    },
    onSuccess: (comment) => {
      queryClient.invalidateQueries({ queryKey: ['community', 'comments', comment.sighting_id] });
      queryClient.invalidateQueries({ queryKey: ['community', 'sighting', comment.sighting_id] });
      queryClient.invalidateQueries({ queryKey: ['community', 'feed'] });
    },
  });
}
