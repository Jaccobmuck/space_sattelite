import { create } from 'zustand';
import api from '../lib/api';

export interface User {
  id: number;
  email: string;
  plan: 'free' | 'pro';
  stripe_customer_id: string | null;
  created_at: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
  updateUserEmail: (email: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  isLoading: false,

  setAuth: (user, accessToken) => {
    localStorage.setItem('accessToken', accessToken);
    set({ user, accessToken });
  },

  clearAuth: () => {
    localStorage.removeItem('accessToken');
    set({ user: null, accessToken: null });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('accessToken', data.accessToken);
      set({ user: data.user, accessToken: data.accessToken, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/register', { email, password });
      localStorage.setItem('accessToken', data.accessToken);
      set({ user: data.user, accessToken: data.accessToken, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Ignore errors on logout
    }
    localStorage.removeItem('accessToken');
    set({ user: null, accessToken: null });
  },

  refreshToken: async () => {
    try {
      const { data } = await api.post('/api/auth/refresh');
      localStorage.setItem('accessToken', data.accessToken);
      set({ user: data.user, accessToken: data.accessToken });
    } catch {
      localStorage.removeItem('accessToken');
      set({ user: null, accessToken: null });
    }
  },

  updateUserEmail: (email) => {
    set((state) => ({
      user: state.user ? { ...state.user, email } : null,
    }));
  },
}));
