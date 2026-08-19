import { create } from 'zustand';

const STORAGE_KEY = 'kemsap.auth';

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { user: null, token: null, refreshToken: null };
  } catch {
    return { user: null, token: null, refreshToken: null };
  }
}

function persist(state) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ user: state.user, token: state.token, refreshToken: state.refreshToken }),
  );
}

export const useAuthStore = create((set, get) => ({
  ...loadInitial(),

  login: ({ user, token, refreshToken }) => {
    set({ user, token, refreshToken });
    persist(get());
  },

  setToken: (token) => {
    set({ token });
    persist(get());
  },

  logout: () => {
    set({ user: null, token: null, refreshToken: null });
    localStorage.removeItem(STORAGE_KEY);
  },

  isAuthenticated: () => !!get().token,
}));
