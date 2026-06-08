// frontend/src/pages/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import safeStorage from './safeStorage';

const HP_API_BASE = import.meta.env.VITE_API_BASE || 'https://hostpilot-smoobu.onrender.com';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // ── Access token lives ONLY in memory ────────────────────────────
  // Using a ref (not state) so reads/writes are synchronous and don't
  // trigger re-renders. Components that need to react to auth changes
  // should use isReady / getUser(), not the token directly.
  const accessTokenRef = useRef(null);

  // isReady: true once the AuthProvider has finished its one-time
  // hydration pass (consuming URL params, attempting silent refresh).
  // ProtectedRoute waits for this before calling verifySession.
  const [isReady, setIsReady] = useState(false);

  // ── Token accessors ───────────────────────────────────────────────
  const getToken = useCallback(() => accessTokenRef.current, []);

  const setToken = useCallback((t) => {
    accessTokenRef.current = t || null;
  }, []);

  // ── User accessors (display data only — not a secret) ────────────
  const getUser = useCallback(() => {
    try {
      return JSON.parse(safeStorage.getItem('hp_user') || 'null');
    } catch {
      return null;
    }
  }, []);

  const setUser = useCallback((u) => {
    if (u) {
      safeStorage.setItem('hp_user', JSON.stringify(u));
    } else {
      safeStorage.removeItem('hp_user');
    }
  }, []);

  // ── Clear: wipe memory token + stored user ────────────────────────
  const clear = useCallback(() => {
    accessTokenRef.current = null;
    safeStorage.removeItem('hp_user');
    // Belt-and-suspenders: remove any legacy keys left from older versions
    try { localStorage.removeItem('hp_access_token'); } catch { /* ignore */ }
    try { localStorage.removeItem('hp_user'); } catch { /* ignore */ }
    try { localStorage.removeItem('user'); } catch { /* ignore */ }
    try { localStorage.removeItem('auth_user'); } catch { /* ignore */ }
    try { localStorage.removeItem('currentUser'); } catch { /* ignore */ }
    try { localStorage.removeItem('hostpilot_user'); } catch { /* ignore */ }
    try { sessionStorage.removeItem('hp_must_change_password'); } catch { /* ignore */ }
    try { sessionStorage.removeItem('hp_must_change_pin'); } catch { /* ignore */ }
    try { sessionStorage.removeItem('hp_selected_property_id'); } catch { /* ignore */ }
  }, []);

  // ── Silent refresh on mount ───────────────────────────────────────
  // On hard reload the in-memory token is gone. Attempt a silent
  // refresh using the HttpOnly 'rt' cookie. If the cookie is valid,
  // the server returns a new encrypted access token and we store it
  // in memory. If the cookie is missing/expired, we stay logged out.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const res = await fetch(`${HP_API_BASE}/auth/refresh`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'x-api-key': import.meta.env.VITE_API_KEY },
        });

        if (!cancelled && res.ok) {
          const data = await res.json();
          accessTokenRef.current = data.accessToken || null;
          if (data.user) setUser(data.user);
        } else if (!cancelled) {
          // Cookie missing or revoked — ensure memory is clean
          accessTokenRef.current = null;
        }
      } catch {
        if (!cancelled) accessTokenRef.current = null;
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    hydrate();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab-close beacon ──────────────────────────────────────────────
  // When the user closes the tab or navigates away, send a beacon to
  // /auth/revoke-token so the server marks the jti as revoked.
  // sendBeacon is fire-and-forget and works even during page unload.
  useEffect(() => {
    function handleUnload() {
      const token = accessTokenRef.current;
      if (!token) return;

      const blob = new Blob(
        [JSON.stringify({ token })],
        { type: 'application/json' }
      );
      navigator.sendBeacon(`${HP_API_BASE}/auth/revoke-token`, blob);
    }

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        getToken,
        setToken,
        getUser,
        setUser,
        clear,
        isReady,
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