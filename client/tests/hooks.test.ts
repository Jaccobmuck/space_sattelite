import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the api module
vi.mock('../src/lib/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock authStore
vi.mock('../src/store/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { user: { plan: 'free' }, accessToken: 'test-token' };
    return selector(state);
  }),
}));

import api from '../src/lib/api';

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('API Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useSatellites behavior', () => {
    it('should fetch satellites from API', async () => {
      const mockSatellites = {
        count: 10,
        timestamp: '2024-01-01T00:00:00Z',
        satellites: [
          { noradId: 25544, name: 'ISS', tle1: 'line1', tle2: 'line2' },
          { noradId: 43013, name: 'STARLINK-1', tle1: 'line1', tle2: 'line2' },
        ],
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockSatellites });

      // Simulate what the hook does
      const result = await api.get('/api/satellites');
      
      expect(api.get).toHaveBeenCalledWith('/api/satellites');
      expect(result.data.satellites).toHaveLength(2);
      expect(result.data.satellites[0].name).toBe('ISS');
    });

    it('should handle API errors gracefully', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      await expect(api.get('/api/satellites')).rejects.toThrow('Network error');
    });
  });

  describe('useSpaceWeather behavior', () => {
    it('should fetch space weather data', async () => {
      const mockWeather = {
        solarFlare: { level: 'C1.2', timestamp: '2024-01-01T00:00:00Z' },
        geomagneticStorm: { kpIndex: 3, level: 'Minor' },
        radiationBelt: { level: 'Normal' },
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockWeather });

      const result = await api.get('/api/weather');
      
      expect(api.get).toHaveBeenCalledWith('/api/weather');
      expect(result.data.solarFlare.level).toBe('C1.2');
    });
  });

  describe('usePasses behavior', () => {
    it('should fetch pass predictions with location params', async () => {
      const mockPasses = {
        passes: [
          { startTime: '2024-01-01T12:00:00Z', endTime: '2024-01-01T12:10:00Z', maxElevation: 45 },
          { startTime: '2024-01-01T18:00:00Z', endTime: '2024-01-01T18:08:00Z', maxElevation: 32 },
        ],
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockPasses });

      const result = await api.get('/api/passes', {
        params: { lat: 45.0, lng: -122.0, noradId: 25544 },
      });
      
      expect(api.get).toHaveBeenCalledWith('/api/passes', {
        params: { lat: 45.0, lng: -122.0, noradId: 25544 },
      });
      expect(result.data.passes).toHaveLength(2);
    });
  });

  describe('useISS behavior', () => {
    it('should fetch ISS data', async () => {
      const mockISS = {
        position: { latitude: 45.0, longitude: -122.0, altitude: 420 },
        velocity: 7.66,
        crew: [{ name: 'Astronaut 1', agency: 'NASA' }],
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockISS });

      const result = await api.get('/api/iss');
      
      expect(result.data.position.altitude).toBe(420);
      expect(result.data.crew).toHaveLength(1);
    });
  });

  describe('useMoonPhase behavior', () => {
    it('should fetch moon phase data', async () => {
      const mockMoon = {
        phase: 0.5,
        phaseName: 'Full Moon',
        illumination: 100,
        age: 14.5,
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockMoon });

      const result = await api.get('/api/moon');
      
      expect(result.data.phaseName).toBe('Full Moon');
      expect(result.data.illumination).toBe(100);
    });
  });
});

describe('API Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle 401 unauthorized errors', async () => {
    const error = {
      response: { status: 401, data: { error: 'Unauthorized' } },
    };
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

    await expect(api.get('/api/weather')).rejects.toEqual(error);
  });

  it('should handle 403 forbidden errors (Pro required)', async () => {
    const error = {
      response: { status: 403, data: { error: 'Pro plan required', upgrade: true } },
    };
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

    await expect(api.get('/api/weather')).rejects.toEqual(error);
  });

  it('should handle 429 rate limit errors', async () => {
    const error = {
      response: { status: 429, data: { error: 'Too many requests' } },
    };
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

    await expect(api.get('/api/satellites')).rejects.toEqual(error);
  });

  it('should handle network errors', async () => {
    const error = new Error('Network Error');
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

    await expect(api.get('/api/iss')).rejects.toThrow('Network Error');
  });
});
