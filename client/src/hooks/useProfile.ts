import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { PublicProfile, ProfileStats, CommunitySighting, FeedPagination } from '../types';

interface ProfileResponse {
  profile: PublicProfile;
  stats: ProfileStats;
  sightings: {
    items: CommunitySighting[];
    total: number;
    hasMore: boolean;
  };
}

interface ProfileSightingsResponse {
  sightings: CommunitySighting[];
  pagination: FeedPagination;
}

export function usePublicProfile(username: string | null) {
  return useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      if (!username) return null;
      const { data } = await api.get<ProfileResponse>(`/api/profile/${username}`);
      return data;
    },
    enabled: !!username,
  });
}

export function useProfileSightings(username: string | null) {
  return useInfiniteQuery({
    queryKey: ['profile', username, 'sightings'],
    queryFn: async ({ pageParam = 1 }) => {
      if (!username) {
        return { sightings: [], pagination: { page: 1, limit: 20, total: 0, hasMore: false } };
      }
      const { data } = await api.get<ProfileSightingsResponse>(
        `/api/profile/${username}/sightings?page=${pageParam}&limit=20`
      );
      return data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.hasMore) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: !!username,
  });
}

export function useCheckUsername() {
  return useMutation({
    mutationFn: async (username: string) => {
      const { data } = await api.get<{ available: boolean }>(
        `/api/profile/username/check/${username}`
      );
      return data.available;
    },
  });
}

export function useSetUsername() {
  const refreshUser = useAuthStore((state) => state.refreshUser);

  return useMutation({
    mutationFn: async (username: string) => {
      const { data } = await api.post<{ username: string }>('/api/profile/username', { username });
      return data.username;
    },
    onSuccess: () => {
      // Refresh Zustand auth state instead of dead React Query invalidation
      refreshUser();
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const refreshUser = useAuthStore((state) => state.refreshUser);

  return useMutation({
    mutationFn: async (fields: {
      display_name?: string;
      bio?: string;
      avatar?: string | null;
      location_city?: string;
      location_region?: string;
      lat?: number;
      lng?: number;
    }) => {
      await api.patch('/api/profile/me', fields);
    },
    onSuccess: () => {
      // Refresh Zustand auth state instead of dead React Query invalidation
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
