import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { CommunitySighting, FeedTab, FeedPagination } from '../types';

interface FeedResponse {
  sightings: CommunitySighting[];
  pagination: FeedPagination;
}

interface FeedParams {
  tab: FeedTab;
  satellite?: string;
  lat?: number;
  lng?: number;
}

export function useCommunityFeed(params: FeedParams) {
  const { tab, satellite, lat, lng } = params;

  return useInfiniteQuery({
    queryKey: ['community', 'feed', tab, satellite, lat, lng],
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams({
        tab,
        page: pageParam.toString(),
        limit: '20',
      });

      if (satellite) {
        searchParams.set('satellite', satellite);
      }

      if (lat !== undefined && lng !== undefined) {
        searchParams.set('lat', lat.toString());
        searchParams.set('lng', lng.toString());
      }

      const { data } = await api.get<FeedResponse>(
        `/api/community/sightings?${searchParams}`
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
  });
}

export function useSatellitesList() {
  return useQuery({
    queryKey: ['community', 'satellites'],
    queryFn: async () => {
      const { data } = await api.get<{ satellites: string[] }>('/api/community/satellites');
      return data.satellites;
    },
  });
}
