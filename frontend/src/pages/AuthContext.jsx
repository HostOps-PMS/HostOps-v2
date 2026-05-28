import React, { createContext, useContext, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const getToken = useCallback(() => sessionStorage.getItem('hp_access_token'), []);

  const getUser = useCallback(() => {
    try {
      return JSON.parse(sessionStorage.getItem('hp_user') || 'null');
    } catch {
      return null;
    }
  }, []);

  const setToken = useCallback((t) => {
    if (t) {
      sessionStorage.setItem('hp_access_token', t);
    } else {
      sessionStorage.removeItem('hp_access_token');
    }
  }, []);

  // ✅ FIX: setUser was missing — any call to auth.setUser(...) was silently
  // doing nothing (undefined), so the stored user object was never updated
  // after login, refresh, or verifySession. Now persists to sessionStorage.
  const setUser = useCallback((u) => {
    if (u) {
      sessionStorage.setItem('hp_user', JSON.stringify(u));
    } else {
      sessionStorage.removeItem('hp_user');
    }
  }, []);

  const clear = useCallback(() => {
    sessionStorage.removeItem('hp_access_token');
    sessionStorage.removeItem('hp_user');
  }, []);

  // ✅ FIX: Consume cross-origin handoff token from URL params.
  // When the login app (localhost:5174) redirects here with ?_t=...&_u=...,
  // we store them into this app's sessionStorage and immediately clean the
  // URL so the token is never visible in the address bar or browser history.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token   = params.get('_t');
    const userRaw = params.get('_u');

    if (token && userRaw) {
      try {
        sessionStorage.setItem('hp_access_token', token);
        sessionStorage.setItem('hp_user', userRaw);
      } catch {
        // sessionStorage write failed (private browsing quota, etc.) — ignore
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