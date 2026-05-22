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

  const setToken = useCallback((t) => sessionStorage.setItem('hp_access_token', t), []);

  const clear = useCallback(() => {
    sessionStorage.removeItem('hp_access_token');
    sessionStorage.removeItem('hp_user');
  }, []);

  return (
    <AuthContext.Provider value={{ getToken, getUser, setToken, clear }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
