import { create } from 'zustand';
import type { Satellite, PanelType, UserLocation } from '../types';

interface AppState {
  selectedSatellite: Satellite | null;
  activePanel: PanelType;
  userLocation: UserLocation | null;
  sidebarCollapsed: boolean;
  isISSMode: boolean;
  satellites: Satellite[];
  isLoading: boolean;
  error: string | null;

  selectSatellite: (satellite: Satellite | null) => void;
  setActivePanel: (panel: PanelType) => void;
  setUserLocation: (location: UserLocation | null) => void;
  toggleSidebar: () => void;
  setISSMode: (enabled: boolean) => void;
  setSatellites: (satellites: Satellite[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedSatellite: null,
  activePanel: null,
  userLocation: null,
  sidebarCollapsed: false,
  isISSMode: false,
  satellites: [],
  isLoading: false,
  error: null,

  selectSatellite: (satellite) =>
    set({
      selectedSatellite: satellite,
      activePanel: satellite ? 'satellite' : null,
    }),

  setActivePanel: (panel) =>
    set({
      activePanel: panel,
      selectedSatellite: panel !== 'satellite' ? null : undefined,
    } as Partial<AppState>),

  setUserLocation: (location) => set({ userLocation: location }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setISSMode: (enabled) =>
    set({
      isISSMode: enabled,
      activePanel: enabled ? 'iss' : null,
    }),

  setSatellites: (satellites) => set({ satellites }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}));
