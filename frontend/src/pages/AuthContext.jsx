import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import safeStorage from './safeStorage';

// ─── Why safeStorage instead of localStorage directly? ───────────────────────
//
// On go.hostops.online (and any cross-origin iframe or hardened browser
// context), accessing `localStorage` throws a SecurityError BEFORE you can
// read or write it.  Every auth helper — getToken, getUser, setToken, setUser,
// clear — was calling localStorage directly, so they all threw, getToken()
// returned null, ProtectedRoute set status='denied', and the redirect loop
// (ERR_TOO_MANY_REDIRECTS) began.
//
// safeStorage detects the failure once at module-load time and silently falls
// back to an in-memory Map.  Auth state won't survive a hard reload in that
// fallback mode, but the app will at least function correctly for the session
// and the redirect loop is eliminated.
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // isReady signals that the AuthContext has finished its one-time hydration
  // pass (consuming ?_t=...&_u=... from the URL, if present).
  // ProtectedRoute waits for isReady=true before calling verifySession, which
  // prevents the race condition where verifySession fires before the
  // cross-origin token has been written to storage.
  const [isReady, setIsReady] = useState(false);

  const getToken = useCallback(
    () => safeStorage.getItem('hp_access_token'),
    []
  );

  const getUser = useCallback(() => {
    try {
      return JSON.parse(safeStorage.getItem('hp_user') || 'null');
    } catch {
      return null;
    }
  }, []);

  const setToken = useCallback((t) => {
    if (t) {
      safeStorage.setItem('hp_access_token', t);
    } else {
      safeStorage.removeItem('hp_access_token');
    }
  }, []);

  // setUser persists the user object so getUser() is never stale after login,
  // token refresh, or verifySession calls.
  const setUser = useCallback((u) => {
    if (u) {
      safeStorage.setItem('hp_user', JSON.stringify(u));
    } else {
      safeStorage.removeItem('hp_user');
    }
  }, []);

  const clear = useCallback(() => {
    safeStorage.removeItem('hp_access_token');
    safeStorage.removeItem('hp_user');
  }, []);

  // Consume cross-origin handoff token from URL params (?_t=...&_u=...).
  // When the login app redirects here, store the token + user into safeStorage
  // immediately, then clean the URL so the token is never visible in the
  // address bar or browser history.
  // isReady is set to true after this runs — whether or not params were
  // present — so ProtectedRoute knows it's safe to call getToken().
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token   = params.get('_t');
    const userRaw = params.get('_u');

    if (token && userRaw) {
      // safeStorage.setItem never throws — fallback is handled internally.
      safeStorage.setItem('hp_access_token', token);
      safeStorage.setItem('hp_user', userRaw);

      // Remove _t and _u from the URL without a page reload.
      const clean = new URL(window.location.href);
      clean.searchParams.delete('_t');
      clean.searchParams.delete('_u');
      window.history.replaceState({}, '', clean.toString());
    }

    // Always mark ready after this effect.
    setIsReady(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        getToken,
        getUser,
        setToken,
        setUser,
        clear,
        isReady,
        // Expose so components can warn users if storage won't persist.
        storageIsPersistent: safeStorage.isPersistent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}