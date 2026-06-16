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
import { decryptApiResponse, generateSessionHint } from './utils/responseDecryption';

const HP_API_BASE = import.meta.env.VITE_API_URL || 'https://api.hostops.online';

const AuthContext = createContext(null);

// Wraps a fetch Response so that .json() transparently decrypts AES-256-GCM
// envelopes ({ e: 1, d, i, t }) using the current session key.
// Returns a plain wrapper object with the same surface as a fetch Response.
function withDecryption(res, sessionKeyRef) {
  const originalJson = res.json.bind(res);
  return {
    ok:         res.ok,
    status:     res.status,
    statusText: res.statusText,
    headers:    res.headers,
    url:        res.url,
    json: async () => {
      const raw = await originalJson();
      if (raw && raw.e === 1 && sessionKeyRef.current) {
        return decryptApiResponse(raw, sessionKeyRef.current);
      }
      return raw;
    },
    text:        () => res.text(),
    blob:        () => res.blob(),
    arrayBuffer: () => res.arrayBuffer(),
    clone:       () => res.clone(),
  };
}

export function AuthProvider({ children }) {
  // ── Access token lives ONLY in memory ────────────────────────────
  const accessTokenRef = useRef(null);

  // ── Session key lives ONLY in memory (never persisted) ───────────
  // Received from the server on every login/refresh as `sk` (base64 AES key).
  // Used to decrypt encrypted API responses and to sign X-Session-Hint headers.
  const sessionKeyRef = useRef(null);

  // isReady: true once hydration (silent refresh on mount) has completed.
  const [isReady, setIsReady] = useState(false);

  // ── Token accessors ───────────────────────────────────────────────
  const getToken = useCallback(() => accessTokenRef.current, []);
  const setToken = useCallback((t) => { accessTokenRef.current = t || null; }, []);

  // ── Session key accessors ─────────────────────────────────────────
  const getSessionKey = useCallback(() => sessionKeyRef.current, []);
  const setSessionKey = useCallback((sk) => { sessionKeyRef.current = sk || null; }, []);

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

  // ── Silent token refresh ──────────────────────────────────────────
  const refreshToken = useCallback(async () => {
    try {
      const res = await fetch(`${HP_API_BASE}/auth/refresh`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'x-api-key': import.meta.env.VITE_API_KEY },
      });
      if (!res.ok) {
        accessTokenRef.current = null;
        sessionKeyRef.current  = null;
        return null;
      }
      const data = await res.json();
      const newToken = data.accessToken || null;
      accessTokenRef.current = newToken;
      if (data.sk)   sessionKeyRef.current = data.sk;
      if (data.user) setUser(data.user);
      return newToken;
    } catch {
      accessTokenRef.current = null;
      sessionKeyRef.current  = null;
      return null;
    }
  }, [setUser]);

  // ── fetchWithAuth ─────────────────────────────────────────────────
  // Drop-in replacement for fetch() that:
  //   1. Attaches the current access token + API key automatically
  //   2. Adds an HMAC-signed X-Session-Hint header for each request
  //   3. On 401, silently refreshes the token once and retries
  //   4. Transparently decrypts AES-256-GCM response envelopes
  const fetchWithAuth = useCallback(async (url, options = {}) => {
    const hint = await generateSessionHint(sessionKeyRef.current).catch(() => null);

    const makeHeaders = (token) => ({
      'Content-Type': 'application/json',
      'x-api-key':    import.meta.env.VITE_API_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(hint   ? { 'X-Session-Hint': hint } : {}),
      ...(options.headers || {}),
    });

    let res = await fetch(url, {
      ...options,
      headers: makeHeaders(accessTokenRef.current),
    });

    if (res.status === 401) {
      const newToken = await refreshToken();
      if (!newToken) return res;
      // Regenerate hint with (possibly new) session key after refresh
      const newHint = await generateSessionHint(sessionKeyRef.current).catch(() => null);
      res = await fetch(url, {
        ...options,
        headers: {
          ...makeHeaders(newToken),
          ...(newHint ? { 'X-Session-Hint': newHint } : {}),
        },
      });
    }

    return withDecryption(res, sessionKeyRef);
  }, [refreshToken]);

  // ── Clear: wipe memory token + session key + stored user ─────────
  const clear = useCallback(() => {
    accessTokenRef.current = null;
    sessionKeyRef.current  = null;
    safeStorage.removeItem('hp_user');
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
          if (data.sk)   sessionKeyRef.current = data.sk;
          if (data.user) setUser(data.user);
        } else if (!cancelled) {
          accessTokenRef.current = null;
          sessionKeyRef.current  = null;
        }
      } catch {
        if (!cancelled) {
          accessTokenRef.current = null;
          sessionKeyRef.current  = null;
        }
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    hydrate();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab-close beacon ──────────────────────────────────────────────
  // Send a revoke beacon ONLY on true tab/window close, NOT on refresh.
  //
  // ROOT CAUSE OF REDIRECT-ON-REFRESH BUG:
  // The original code used 'beforeunload' which fires on F5/Ctrl+R too.
  // This revoked the refresh token BEFORE the page reloaded, so the
  // hydrate() call above always got 401 → token = null → redirect to "/".
  //
  // THE FIX — pagehide + focus-cancel timer:
  // 'pagehide' fires on both close and refresh. We delay the beacon by
  // 500ms. If the window receives a 'focus' event within that window
  // (meaning the page just reloaded and the browser tab is active again),
  // we cancel the beacon. A true tab/window close never regains focus,
  // so the beacon fires normally after the delay.
  useEffect(() => {
    let revokeTimer = null;

    function handlePageHide(e) {
      if (e.persisted) return;
      const token = accessTokenRef.current;
      if (!token) return;

      revokeTimer = setTimeout(() => {
        const blob = new Blob(
          [JSON.stringify({ token })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(`${HP_API_BASE}/auth/revoke-token`, blob);
        revokeTimer = null;
      }, 500);
    }

    function handleFocus() {
      if (revokeTimer !== null) {
        clearTimeout(revokeTimer);
        revokeTimer = null;
      }
    }

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('focus',    handleFocus);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('focus',    handleFocus);
      if (revokeTimer !== null) clearTimeout(revokeTimer);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        getToken,
        setToken,
        getSessionKey,
        setSessionKey,
        getUser,
        setUser,
        clear,
        isReady,
        refreshToken,
        fetchWithAuth,
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
