import React, { createContext, useContext, useCallback } from 'react';

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