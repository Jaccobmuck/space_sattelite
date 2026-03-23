import { create } from 'zustand';
import api from '../lib/api';

export interface User {
  id: string;
  email: string;
  plan: 'free' | 'pro';
  stripe_customer_id: string | null;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  location_city: string | null;
  location_region: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  clearAuth: () => void;
  updateUserEmail: (email: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;
    
    try {
      // Server will read token from HttpOnly cookie
      const { data } = await api.get('/api/auth/me');
      set({ 
        user: data.user, 
        initialized: true,
      });
    } catch {
      // Token invalid or missing, try refresh
      try {
        const { data } = await api.post('/api/auth/refresh');
        set({ 
          user: data.user, 
          initialized: true,
        });
      } catch {
        set({ user: null, initialized: true });
      }
    }
  },

  refreshUser: async () => {
    // Force fetch user data regardless of initialized state
    try {
      const { data } = await api.get('/api/auth/me');
      set({ user: data.user, initialized: true });
    } catch {
      // If /me fails, try refresh
      try {
        const { data } = await api.post('/api/auth/refresh');
        set({ user: data.user, initialized: true });
      } catch {
        set({ user: null, initialized: true });
      }
    }
  },

  setUser: (user) => {
    set({ user });
  },

  clearAuth: () => {
    set({ user: null });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      // Server sets HttpOnly cookies automatically
      set({ 
        user: data.user, 
        isLoading: false,
        initialized: true,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (email, password) => {
    set({ isLoading: true });
    try {
      await api.post('/api/auth/register', { email, password });
      
      // Registration successful, now login
      set({ isLoading: false });
      
      // Auto-login after registration
      await get().login(email, password);
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    // Always clear local state
    set({ user: null });
    
    // Server clears HttpOnly cookies - don't swallow errors silently
    // but still clear local state even if server call fails
    await api.post('/api/auth/logout');
  },

  updateUserEmail: (email) => {
    set((state) => ({
      user: state.user ? { ...state.user, email } : null,
    }));
  },
}));
