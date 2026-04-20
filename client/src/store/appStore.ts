import { create } from 'zustand';
import type { SatRec } from 'satellite.js';
import type { Satellite, PanelType, UserLocation, GroundTrack, PinnedSatellite } from '../types';

const PIN_COLORS = ['#f87171', '#4ade80', '#a855f7']; // Red, Green, Purple

export type TimeSpeed = 0 | 1 | 10 | 60 | 600;
export type ConstellationFilter = 'all' | 'stations' | 'starlink' | 'gps' | 'weather' | 'amateur' | 'debris';

interface AppState {
  selectedSatellite: Satellite | null;
  activePanel: PanelType;
  userLocation: UserLocation | null;
  sidebarCollapsed: boolean;
  isISSMode: boolean;
  satellites: Satellite[];
  isLoading: boolean;
  error: string | null;
  groundTrack: GroundTrack | null;
  simulatedTime: Date;
  timeMultiplier: TimeSpeed;
  lastRealTime: number;
  constellationFilter: ConstellationFilter;
  searchHighlightId: number | null;
  pinnedSatellites: PinnedSatellite[];
  satrecMap: Map<number, SatRec>;

  // ── Overlay visibility ────────────────────────────────────────────────────
  /** IAU constellation stick-figure overlay visibility */
  constellationsVisible: boolean;
  /** Deep-sky object marker visibility */
  dsoVisible: boolean;
  /** Red night-vision filter for dark-adapted viewing */
  nightVision: boolean;

  selectSatellite: (satellite: Satellite | null) => void;
  setActivePanel: (panel: PanelType) => void;
  setUserLocation: (location: UserLocation | null) => void;
  toggleSidebar: () => void;
  setISSMode: (enabled: boolean) => void;
  setSatellites: (satellites: Satellite[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setGroundTrack: (track: GroundTrack | null) => void;
  setTimeMultiplier: (speed: TimeSpeed) => void;
  advanceSimulatedTime: (deltaMs: number) => void;
  resetSimulatedTime: () => void;
  setConstellationFilter: (filter: ConstellationFilter) => void;
  setSearchHighlight: (noradId: number | null) => void;
  pinSatellite: (satellite: Satellite) => void;
  unpinSatellite: (noradId: number) => void;
  updatePinnedGroundTrack: (noradId: number, track: GroundTrack | null) => void;
  setSatrecMap: (map: Map<number, SatRec>) => void;
  updateSelectedSatellitePosition: (lat: number, lng: number, alt: number, velocity: number) => void;
  toggleConstellations: () => void;
  toggleDso: () => void;
  toggleNightVision: () => void;
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
  groundTrack: null,
  simulatedTime: new Date(),
  timeMultiplier: 1 as TimeSpeed,
  lastRealTime: Date.now(),
  constellationFilter: 'all' as ConstellationFilter,
  searchHighlightId: null,
  pinnedSatellites: [],
  satrecMap: new Map(),
  constellationsVisible: true,
  dsoVisible: false,
  nightVision: false,

  selectSatellite: (satellite) =>
    set({
      selectedSatellite: satellite,
      activePanel: satellite ? 'satellite' : null,
      groundTrack: null,
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

  setGroundTrack: (track) => set({ groundTrack: track }),

  setTimeMultiplier: (speed) =>
    set({
      timeMultiplier: speed,
      lastRealTime: Date.now(),
    }),

  advanceSimulatedTime: (deltaMs) =>
    set((state) => ({
      simulatedTime: new Date(state.simulatedTime.getTime() + deltaMs * state.timeMultiplier),
    })),

  resetSimulatedTime: () =>
    set({
      simulatedTime: new Date(),
      timeMultiplier: 1 as TimeSpeed,
      lastRealTime: Date.now(),
    }),

  setConstellationFilter: (filter) => set({ constellationFilter: filter }),

  setSearchHighlight: (noradId) => set({ searchHighlightId: noradId }),

  pinSatellite: (satellite) =>
    set((state) => {
      if (state.pinnedSatellites.some((p) => p.satellite.noradId === satellite.noradId)) {
        return state;
      }

      const usedColors = state.pinnedSatellites.map((p) => p.color);
      const availableColor = PIN_COLORS.find((c) => !usedColors.includes(c)) || PIN_COLORS[0];

      let newPinned = [...state.pinnedSatellites];
      if (newPinned.length >= 3) {
        newPinned = newPinned.slice(1);
      }

      newPinned.push({
        satellite,
        color: availableColor,
        groundTrack: null,
      });

      return { pinnedSatellites: newPinned };
    }),

  unpinSatellite: (noradId) =>
    set((state) => ({
      pinnedSatellites: state.pinnedSatellites.filter(
        (p) => p.satellite.noradId !== noradId
      ),
    })),

  updatePinnedGroundTrack: (noradId, track) =>
    set((state) => ({
      pinnedSatellites: state.pinnedSatellites.map((p) =>
        p.satellite.noradId === noradId ? { ...p, groundTrack: track } : p
      ),
    })),

  setSatrecMap: (map) => set({ satrecMap: map }),

  updateSelectedSatellitePosition: (lat, lng, alt, velocity) =>
    set((state) => {
      if (!state.selectedSatellite) return state;
      return {
        selectedSatellite: {
          ...state.selectedSatellite,
          lat,
          lng,
          alt,
          velocity,
        },
      };
    }),

  toggleConstellations: () =>
    set((state) => ({ constellationsVisible: !state.constellationsVisible })),

  toggleDso: () =>
    set((state) => ({ dsoVisible: !state.dsoVisible })),

  toggleNightVision: () =>
    set((state) => ({ nightVision: !state.nightVision })),
}));
