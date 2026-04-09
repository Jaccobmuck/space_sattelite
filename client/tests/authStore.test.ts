import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from '../src/store/authStore';

// Mock the api module.
// The store uses both api.get (/api/auth/me) and api.post (/api/auth/login, etc.)
vi.mock('../src/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from '../src/lib/api';

// Full User shape matching the actual store interface
const mockUser = {
  id: 'uuid-1234-abcd',
  email: 'test@example.com',
  plan: 'free' as const,
  stripe_customer_id: null,
  username: null,
  display_name: null,
  bio: null,
  location_city: null,
  location_region: null,
  lat: null,
  lng: null,
  created_at: '2026-01-01T00:00:00Z',
};

describe('authStore', () => {
  beforeEach(() => {
    // Reset to the store's initial state before every test
    useAuthStore.setState({
      user: null,
      isLoading: false,
      initialized: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── initial state ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('should have null user and not be loading by default', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  // ─── setUser ────────────────────────────────────────────────────────────────

  describe('setUser', () => {
    it('should set user in state', () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });
  });

  // ─── clearAuth ──────────────────────────────────────────────────────────────

  describe('clearAuth', () => {
    it('should set user to null', () => {
      useAuthStore.setState({ user: mockUser });
      useAuthStore.getState().clearAuth();
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  // ─── login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should set isLoading to true during login and false after', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: mockUser },
      });

      const loginPromise = useAuthStore.getState().login('test@example.com', 'password123');
      expect(useAuthStore.getState().isLoading).toBe(true);

      await loginPromise;
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should call api.post with the correct endpoint and credentials', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: mockUser },
      });

      await useAuthStore.getState().login('test@example.com', 'password123');

      expect(api.post).toHaveBeenCalledWith('/api/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should set user from the response', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: mockUser },
      });

      await useAuthStore.getState().login('test@example.com', 'password123');
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('should throw on failure and leave isLoading false', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Invalid credentials')
      );

      await expect(
        useAuthStore.getState().login('test@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');

      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  // ─── register ───────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should call register endpoint then auto-login with the same credentials', async () => {
      // register() calls POST /api/auth/register, then internally calls login()
      // which calls POST /api/auth/login — two sequential post calls.
      (api.post as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: {} })                         // register response
        .mockResolvedValueOnce({ data: { user: mockUser } });        // auto-login response

      await useAuthStore.getState().register('new@example.com', 'password123');

      expect(api.post).toHaveBeenNthCalledWith(1, '/api/auth/register', {
        email: 'new@example.com',
        password: 'password123',
      });
      expect(api.post).toHaveBeenNthCalledWith(2, '/api/auth/login', {
        email: 'new@example.com',
        password: 'password123',
      });
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('should throw and clear isLoading when registration fails', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Email already exists')
      );

      await expect(
        useAuthStore.getState().register('existing@example.com', 'password123')
      ).rejects.toThrow('Email already exists');

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  // ─── logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should clear user state and call the logout endpoint', async () => {
      useAuthStore.setState({ user: mockUser });
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});

      await useAuthStore.getState().logout();

      expect(api.post).toHaveBeenCalledWith('/api/auth/logout');
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('should clear user before the server call so state is null even if server throws', async () => {
      // The store sets user to null BEFORE awaiting the server call, so local
      // state is always cleared regardless of server-side failures.
      useAuthStore.setState({ user: mockUser });
      (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      try {
        await useAuthStore.getState().logout();
      } catch {
        // server error propagates — that is expected store behaviour
      }

      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  // ─── updateUserEmail ─────────────────────────────────────────────────────────

  describe('updateUserEmail', () => {
    it('should update the email field on an existing user', () => {
      useAuthStore.setState({ user: mockUser });
      useAuthStore.getState().updateUserEmail('new@example.com');
      expect(useAuthStore.getState().user?.email).toBe('new@example.com');
    });

    it('should not throw and keep user null when user is null', () => {
      useAuthStore.setState({ user: null });
      expect(() => {
        useAuthStore.getState().updateUserEmail('new@example.com');
      }).not.toThrow();
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  // ─── refreshUser ─────────────────────────────────────────────────────────────

  describe('refreshUser', () => {
    it('should fetch user from /api/auth/me and update state', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: mockUser },
      });

      await useAuthStore.getState().refreshUser();

      expect(api.get).toHaveBeenCalledWith('/api/auth/me');
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().initialized).toBe(true);
    });

    it('should fall back to /api/auth/refresh when /me fails', async () => {
      const proUser = { ...mockUser, plan: 'pro' as const };
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Unauthorized')
      );
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: proUser },
      });

      await useAuthStore.getState().refreshUser();

      expect(api.post).toHaveBeenCalledWith('/api/auth/refresh');
      expect(useAuthStore.getState().user).toEqual(proUser);
    });

    it('should set user to null and initialized to true when both /me and /refresh fail', async () => {
      useAuthStore.setState({ user: mockUser });
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Unauthorized')
      );
      (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Refresh failed')
      );

      await useAuthStore.getState().refreshUser();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().initialized).toBe(true);
    });
  });
});
