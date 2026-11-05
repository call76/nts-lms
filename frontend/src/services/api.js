import axios from 'axios';
import { API_URL } from './config';
import { takeHuman, HUMAN_URLS } from './human';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor - Add token to every request
api.interceptors.request.use(
  (config) => {
    // "I am not a robot" answer for the few public endpoints that ask for it
    const path = config.url || '';
    if (HUMAN_URLS.some((u) => path.startsWith(u))) {
      const h = takeHuman();
      if (h.token) {
        if (typeof FormData !== 'undefined' && config.data instanceof FormData) { config.data.append('humanToken', h.token); config.data.append('humanAnswer', h.answer); }
        else if ((config.method || 'get').toLowerCase() === 'get') config.params = { ...(config.params || {}), humanToken: h.token, humanAnswer: h.answer };
        else config.data = { ...(config.data || {}), humanToken: h.token, humanAnswer: h.answer };
      }
    }
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // When a download (blob) fails the server's JSON error arrives as a Blob: turn it back into data.
    const d = error.response?.data;
    if (typeof Blob !== 'undefined' && d instanceof Blob && d.type && d.type.includes('json')) {
      try { error.response.data = JSON.parse(await d.text()); } catch (e) { /* keep blob */ }
    }
    // Only treat 401 as "session expired" for authenticated calls. A wrong password on
    // /auth/login also returns 401 and must NOT reload the page (the error toast was lost).
    const url = error.config?.url || '';
    const isAuthCall = url.startsWith('/auth/') && !url.startsWith('/auth/change-password') && !url.startsWith('/auth/me');
    if (error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // The zustand store persists under 'nts-auth'; if it is left behind, App still thinks the
      // user is logged in and bounces /login -> / -> 401 -> /login forever.
      localStorage.removeItem('nts-auth');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const uploadFile = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0, // big videos need more than the default 30 s
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
      }
    }
  });
  return response.data;
};

export default api;