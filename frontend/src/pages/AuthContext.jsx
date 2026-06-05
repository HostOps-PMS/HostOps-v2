import React, { createContext, useContext, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const getToken = useCallback(() => localStorage.getItem('hp_access_token'), []);

  const getUser = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem('hp_user') || 'null');
    } catch {
      return null;
    }
  }, []);

  const setToken = useCallback((t) => {
    if (t) {
      localStorage.setItem('hp_access_token', t);
    } else {
      localStorage.removeItem('hp_access_token');
    }
  }, []);

  // ✅ FIX: setUser was missing — any call to auth.setUser(...) was silently
  // doing nothing (undefined), so the stored user object was never updated
  // after login, refresh, or verifySession. Now persists to localStorage.
  const setUser = useCallback((u) => {
    if (u) {
      localStorage.setItem('hp_user', JSON.stringify(u));
    } else {
      localStorage.removeItem('hp_user');
    }
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem('hp_access_token');
    localStorage.removeItem('hp_user');
  }, []);

  // ✅ FIX: Consume cross-origin handoff token from URL params.
  // When the login app redirects here with ?_t=...&_u=...,
  // we store them into this app's localStorage and immediately clean the
  // URL so the token is never visible in the address bar or browser history.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token   = params.get('_t');
    const userRaw = params.get('_u');

    if (token && userRaw) {
      try {
        localStorage.setItem('hp_access_token', token);
        localStorage.setItem('hp_user', userRaw);
      } catch {
        // localStorage write failed (private browsing quota, etc.) — ignore
      }

      // Remove _t and _u from the URL without triggering a page reload
      const clean = new URL(window.location.href);
      clean.searchParams.delete('_t');
      clean.searchParams.delete('_u');
      window.history.replaceState({}, '', clean.toString());
    }
  }, []);

  return (
    <AuthContext.Provider value={{ getToken, getUser, setToken, setUser, clear }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}