import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import { API_URL } from '../services/config';

const errMsg = (error, fallback) => error.response?.data?.error || (error.request ? `Cannot reach the server (${API_URL}). Start the backend (cd backend && npm run dev) and check your connection.` : fallback);

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      unreadCount: 0,

      login: async (email, password) => {
        try {
          const res = await api.post('/auth/login', { email, password });
          const { token, user } = res.data;
          localStorage.setItem('token', token);
          set({ user, token, isAuthenticated: true });
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: errMsg(error, 'Login failed'),
            needsVerification: !!error.response?.data?.needsVerification,
          };
        }
      },

      register: async (data) => {
        try {
          const payload = data instanceof FormData ? data : data;
          const res = await api.post('/auth/register', payload, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {});
          // Backend skips the email code when verification is off / email cannot be sent in development
          if (res.data.autoVerified && res.data.token) {
            localStorage.setItem('token', res.data.token);
            set({ user: res.data.user, token: res.data.token, isAuthenticated: true });
            return { success: true, autoVerified: true, unlinkedEmails: res.data.unlinkedEmails || [] };
          }
          return { success: true, email: res.data.email || data.email, unlinkedEmails: res.data.unlinkedEmails || [] };
        } catch (error) {
          return { success: false, error: errMsg(error, 'Registration failed') };
        }
      },

      verifyOTP: async (email, otp) => {
        try {
          const res = await api.post('/auth/verify-otp', { email, otp });
          const { token, user } = res.data;
          localStorage.setItem('token', token);
          set({ user, token, isAuthenticated: true });
          return { success: true };
        } catch (error) {
          return { success: false, error: errMsg(error, 'Verification failed') };
        }
      },

      resendOTP: async (email) => {
        try {
          await api.post('/auth/resend-otp', { email });
          return { success: true };
        } catch (error) {
          return { success: false, error: errMsg(error, 'Failed to resend code') };
        }
      },

      updateProfile: async (data) => {
        try {
          const res = await api.put('/users/profile', data);
          set({ user: { ...get().user, ...res.data } });
          return { success: true };
        } catch (error) {
          return { success: false, error: errMsg(error, 'Update failed') };
        }
      },

      // Toggle follow/unfollow (Feed.js called this but it did not exist -> crash on click)
      followUser: async (userId) => {
        try {
          const res = await api.post(`/users/${userId}/follow`);
          const me = get().user;
          if (me) {
            const delta = res.data.isFollowing ? 1 : -1;
            set({ user: { ...me, followingCount: Math.max(0, (me.followingCount || 0) + delta) } });
          }
          return { success: true, isFollowing: res.data.isFollowing };
        } catch (error) {
          return { success: false, error: errMsg(error, 'Could not update follow') };
        }
      },

      setUnreadCount: (count) => set({ unreadCount: count }),

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, unreadCount: 0 });
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      },
    }),
    {
      name: 'nts-auth',
      // unreadCount is derived live; don't persist it
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated }),
      // Keep the plain 'token' key (read by the axios interceptor) in sync after a page reload
      onRehydrateStorage: () => (state) => {
        if (state?.token) localStorage.setItem('token', state.token);
      },
    }
  )
);
