import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // FIX: isReady signals that the AuthContext has finished its one-time
  // hydration pass (consuming ?_t=...&_u=... from the URL, if present).
  // ProtectedRoute waits for isReady=true before calling verifySession,
  // which prevents the race condition where verifySession fires before
  // the cross-origin token has been written to localStorage — causing
  // getToken() to return null and triggering a premature redirect to "/".
  const [isReady, setIsReady] = useState(false);

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

  // setUser persists the user object to localStorage so getUser() is
  // never stale after login, token refresh, or verifySession calls.
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

  // Consume cross-origin handoff token from URL params (?_t=...&_u=...).
  // When the login app redirects here, we store the token + user into
  // localStorage immediately, then clean the URL so the token is never
  // visible in the address bar or browser history.
  // isReady is set to true after this runs — whether or not params were present —
  // so ProtectedRoute knows it's safe to call getToken() / verifySession().
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

    // Always mark ready after this effect — tells ProtectedRoute that
    // localStorage is fully hydrated and safe to read.
    setIsReady(true);
  }, []);

  return (
    <AuthContext.Provider value={{ getToken, getUser, setToken, setUser, clear, isReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}