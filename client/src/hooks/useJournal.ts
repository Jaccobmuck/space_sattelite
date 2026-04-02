import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { JournalEntry, JournalOutcome } from '../types';

interface CreateJournalEntryInput {
  satellite_name: string;
  pass_timestamp: string;
  outcome: JournalOutcome;
  star_rating?: number;
  notes?: string;
  is_public?: boolean;
  city?: string;
  region?: string;
  lat?: number;
  lng?: number;
  card_image?: string;
}

interface JournalEntriesResponse {
  entries: JournalEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export function useJournalEntries(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ['journal', 'entries', page, limit],
    queryFn: async () => {
      const { data } = await api.get<JournalEntriesResponse>(
        `/api/journal?page=${page}&limit=${limit}`
      );
      return data;
    },
  });
}

export function useJournalEntry(id: string | null) {
  return useQuery({
    queryKey: ['journal', 'entry', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get<{ entry: JournalEntry }>(`/api/journal/${id}`);
      return data.entry;
    },
    enabled: !!id,
  });
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateJournalEntryInput) => {
      const { data } = await api.post<{ entry: JournalEntry }>('/api/journal', input);
      return data.entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', 'entries'] });
      queryClient.invalidateQueries({ queryKey: ['community', 'feed'] });
    },
  });
}

export function useUpdateJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: {
      id: string;
      notes?: string;
      is_public?: boolean;
      star_rating?: number;
    }) => {
      const { data } = await api.patch<{ entry: JournalEntry }>(`/api/journal/${id}`, fields);
      return data.entry;
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ['journal', 'entries'] });
      queryClient.invalidateQueries({ queryKey: ['journal', 'entry', entry.id] });
      queryClient.invalidateQueries({ queryKey: ['community', 'feed'] });
    },
  });
}

export function useDeleteJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/journal/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', 'entries'] });
      queryClient.invalidateQueries({ queryKey: ['community', 'feed'] });
    },
  });
}

export function useToggleJournalVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<{ is_public: boolean }>(`/api/journal/${id}/visibility`);
      return { id, is_public: data.is_public };
    },
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ['journal', 'entries'] });
      queryClient.invalidateQueries({ queryKey: ['journal', 'entry', id] });
      queryClient.invalidateQueries({ queryKey: ['community', 'feed'] });
    },
  });
}
