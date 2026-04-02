import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from '../src/store/authStore';

// Mock the api module
vi.mock('../src/lib/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

import api from '../src/lib/api';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isLoading: false,
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have null user and accessToken by default', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('setAuth', () => {
    it('should set user and accessToken', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        plan: 'free' as const,
        stripe_customer_id: null,
        created_at: '2024-01-01T00:00:00Z',
      };

      useAuthStore.getState().setAuth(mockUser, 'test-token');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.accessToken).toBe('test-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('accessToken', 'test-token');
    });
  });

  describe('clearAuth', () => {
    it('should clear user and accessToken', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        plan: 'free' as const,
        stripe_customer_id: null,
        created_at: '2024-01-01T00:00:00Z',
      };

      useAuthStore.setState({ user: mockUser, accessToken: 'test-token' });
      useAuthStore.getState().clearAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('accessToken');
    });
  });

  describe('login', () => {
    it('should set loading state during login', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        plan: 'free',
        stripe_customer_id: null,
        created_at: '2024-01-01T00:00:00Z',
      };

      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: mockUser, accessToken: 'new-token' },
      });

      const loginPromise = useAuthStore.getState().login('test@example.com', 'password123');
      
      // Check loading state is true during login
      expect(useAuthStore.getState().isLoading).toBe(true);

      await loginPromise;

      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().accessToken).toBe('new-token');
    });

    it('should call api with correct credentials', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: { id: 1 }, accessToken: 'token' },
      });

      await useAuthStore.getState().login('test@example.com', 'password123');

      expect(api.post).toHaveBeenCalledWith('/api/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should throw error on failed login', async () => {
      const error = new Error('Invalid credentials');
      (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      await expect(
        useAuthStore.getState().login('test@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');

      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('register', () => {
    it('should register and set auth state', async () => {
      const mockUser = {
        id: 1,
        email: 'new@example.com',
        plan: 'free',
        stripe_customer_id: null,
        created_at: '2024-01-01T00:00:00Z',
      };

      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: mockUser, accessToken: 'new-token' },
      });

      await useAuthStore.getState().register('new@example.com', 'password123');

      expect(api.post).toHaveBeenCalledWith('/api/auth/register', {
        email: 'new@example.com',
        password: 'password123',
      });
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().accessToken).toBe('new-token');
    });

    it('should throw error on failed registration', async () => {
      const error = new Error('Email already exists');
      (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      await expect(
        useAuthStore.getState().register('existing@example.com', 'password123')
      ).rejects.toThrow('Email already exists');

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear auth state and call logout endpoint', async () => {
      useAuthStore.setState({
        user: { id: 1, email: 'test@example.com', plan: 'free', stripe_customer_id: null, created_at: '' },
        accessToken: 'test-token',
      });

      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});

      await useAuthStore.getState().logout();

      expect(api.post).toHaveBeenCalledWith('/api/auth/logout');
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('accessToken');
    });

    it('should clear auth state even if logout endpoint fails', async () => {
      useAuthStore.setState({
        user: { id: 1, email: 'test@example.com', plan: 'free', stripe_customer_id: null, created_at: '' },
        accessToken: 'test-token',
      });

      (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      await useAuthStore.getState().logout();

      // Should still clear local state
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should refresh access token and update state', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        plan: 'pro',
        stripe_customer_id: 'cus_123',
        created_at: '2024-01-01T00:00:00Z',
      };

      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: mockUser, accessToken: 'refreshed-token' },
      });

      await useAuthStore.getState().refreshToken();

      expect(api.post).toHaveBeenCalledWith('/api/auth/refresh');
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().accessToken).toBe('refreshed-token');
    });

    it('should clear auth state on refresh failure', async () => {
      useAuthStore.setState({
        user: { id: 1, email: 'test@example.com', plan: 'free', stripe_customer_id: null, created_at: '' },
        accessToken: 'old-token',
      });

      (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Token expired'));

      await useAuthStore.getState().refreshToken();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe('updateUserEmail', () => {
    it('should update user email in state', () => {
      useAuthStore.setState({
        user: { id: 1, email: 'old@example.com', plan: 'free', stripe_customer_id: null, created_at: '' },
        accessToken: 'token',
      });

      useAuthStore.getState().updateUserEmail('new@example.com');

      expect(useAuthStore.getState().user?.email).toBe('new@example.com');
    });

    it('should not crash if user is null', () => {
      useAuthStore.setState({ user: null, accessToken: null });

      expect(() => {
        useAuthStore.getState().updateUserEmail('new@example.com');
      }).not.toThrow();

      expect(useAuthStore.getState().user).toBeNull();
    });
  });
});
