import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({ baseURL: `${API_BASE_URL}/api/v1` });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const refreshToken = useAuthStore.getState().refreshToken;

    if (status === 401 && refreshToken && !original._retry) {
      original._retry = true;
      try {
        refreshing =
          refreshing ||
          axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, { refreshToken });
        const { data } = await refreshing;
        refreshing = null;
        useAuthStore.getState().setToken(data.token);
        original.headers.Authorization = `Bearer ${data.token}`;
        return api(original);
      } catch (err) {
        refreshing = null;
        // Only end the session when the server actually rejected the refresh
        // token. A network blip mid-interview must not sign the interviewer
        // out and lose the room they're in.
        const refreshStatus = err.response?.status;
        if (refreshStatus === 401 || refreshStatus === 403) {
          useAuthStore.getState().logout();
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
