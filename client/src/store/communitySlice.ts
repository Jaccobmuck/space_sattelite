import { create } from 'zustand';
import type { FeedTab } from '../types';

interface CommunityState {
  activeTab: FeedTab;
  selectedSatelliteFilter: string | null;
  openSightingId: string | null;
  
  setActiveTab: (tab: FeedTab) => void;
  setSatelliteFilter: (satellite: string | null) => void;
  openSighting: (id: string) => void;
  closeSighting: () => void;
}

export const useCommunityStore = create<CommunityState>((set) => ({
  activeTab: 'global',
  selectedSatelliteFilter: null,
  openSightingId: null,

  setActiveTab: (tab) => set({ activeTab: tab, selectedSatelliteFilter: null }),
  setSatelliteFilter: (satellite) => set({ selectedSatelliteFilter: satellite }),
  openSighting: (id) => set({ openSightingId: id }),
  closeSighting: () => set({ openSightingId: null }),
}));
