import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar: string | null;
  sighting_count: number;
}

interface LeaderboardResponse {
  leaders: LeaderboardEntry[];
}

export type TimeFilter = 'week' | 'month' | 'all';

export function useLeaderboard(timeFilter: TimeFilter = 'all') {
  return useQuery({
    queryKey: ['community', 'leaderboard', timeFilter],
    queryFn: async () => {
      const { data } = await api.get<LeaderboardResponse>(
        `/api/community/leaderboard?period=${timeFilter}`
      );
      return data;
    },
    staleTime: 60000, // 1 minute
  });
}
