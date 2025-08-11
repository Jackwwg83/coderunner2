import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';
import api from '../api';
import { useDeploymentsStore } from './deployments.store';

interface User {
  id: string;
  email: string;
  planType: 'free' | 'basic' | 'pro' | 'enterprise';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { token, userId } = response.data;
          
          // Store token in both cookie and localStorage
          Cookies.set('auth-token', token, { expires: 7 });
          localStorage.setItem('auth-token', token);
          
          // Set API authorization header
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          set({
            token,
            user: { id: userId, email, planType: 'free' },
            isAuthenticated: true,
            isLoading: false,
            error: null
          });

          // Initialize WebSocket connection after login
          try {
            const deployStore = useDeploymentsStore.getState();
            await deployStore.connectWebSocket(token);
          } catch (wsError) {
            console.warn('Failed to connect WebSocket after login:', wsError);
            // Don't fail login if WebSocket connection fails
          }
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error || 'Login failed'
          });
          throw error;
        }
      },

      register: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/register', { email, password });
          const { userId } = response.data;
          
          // After registration, automatically login
          await get().login(email, password);
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error || 'Registration failed'
          });
          throw error;
        }
      },

      logout: () => {
        // Disconnect WebSocket before logout
        try {
          const deployStore = useDeploymentsStore.getState();
          deployStore.disconnectWebSocket();
        } catch (error) {
          console.warn('Failed to disconnect WebSocket during logout:', error);
        }

        Cookies.remove('auth-token');
        localStorage.removeItem('auth-token');
        delete api.defaults.headers.common['Authorization'];
        
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null
        });
      },

      checkAuth: async () => {
        const token = Cookies.get('auth-token') || localStorage.getItem('auth-token');
        
        if (!token) {
          set({ isAuthenticated: false });
          return;
        }

        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        try {
          // Verify token with backend
          const response = await api.get('/auth/verify');
          set({
            token,
            user: response.data.user,
            isAuthenticated: true
          });

          // Initialize WebSocket connection after successful auth check
          try {
            const deployStore = useDeploymentsStore.getState();
            if (!deployStore.isWebSocketConnected) {
              await deployStore.connectWebSocket(token);
            }
          } catch (wsError) {
            console.warn('Failed to connect WebSocket after auth check:', wsError);
          }
        } catch (error) {
          // Token invalid, clear auth
          get().logout();
        }
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user
      })
    }
  )
);