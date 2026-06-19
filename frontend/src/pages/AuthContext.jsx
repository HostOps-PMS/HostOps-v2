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
import { getSecureUser, setSecureUser, removeSecureUser } from '../lib/secureUserStorage';
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

  // ── Refresh mutex ─────────────────────────────────────────────────
  // Deduplicates concurrent calls to refreshToken(). Without this, two
  // simultaneous 401 retries would each POST /auth/refresh with the same
  // cookie, triggering reuse-attack detection and revoking all sessions.
  const refreshPromiseRef = useRef(null);

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
      return getSecureUser();
    } catch {
      return null;
    }
  }, []);

const setUser = useCallback((u) => {
    if (u) {
      setSecureUser(u);
    } else {
      removeSecureUser();
    }
    window.dispatchEvent(new CustomEvent('hostops:client-user-updated', { detail: u }));
  }, []);

  // ── Silent token refresh ──────────────────────────────────────────
  // Two-layer mutex to prevent duplicate /auth/refresh calls:
  //
  // 1. refreshPromiseRef (per-tab): dedups concurrent callers within the
  //    same tab (e.g. two simultaneous 401 retries). All share one promise.
  //
  // 2. navigator.locks 'hp-token-refresh' (cross-tab): serialises refresh
  //    calls across browser tabs. Without this, two tabs whose access tokens
  //    expire simultaneously both POST /auth/refresh with the same RT cookie —
  //    one succeeds and rotates the token; the other presents the now-revoked
  //    token, triggering reuse-attack detection that wipes all sessions.
  //    With the lock, Tab B waits, then refreshes with the updated cookie.
  const refreshToken = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const doRefresh = async () => {
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
      } finally {
        refreshPromiseRef.current = null;
      }
    };

    refreshPromiseRef.current = (typeof navigator !== 'undefined' && navigator.locks)
      ? navigator.locks.request('hp-token-refresh', doRefresh)
      : doRefresh();

    return refreshPromiseRef.current;
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
    removeSecureUser();
    try { localStorage.removeItem('user'); } catch { /* ignore */ }
    try { localStorage.removeItem('auth_user'); } catch { /* ignore */ }
    try { localStorage.removeItem('currentUser'); } catch { /* ignore */ }
    try { localStorage.removeItem('hostpilot_user'); } catch { /* ignore */ }
    try { sessionStorage.removeItem('hp_must_change_password'); } catch { /* ignore */ }
    try { sessionStorage.removeItem('hp_must_change_pin'); } catch { /* ignore */ }
    try { safeStorage.removeItem('hp_selected_property_id'); } catch { /* ignore */ }
  }, []);

  // ── Silent refresh on mount ───────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();

    // Signal to any lingering pagehide timer from the previous page that this
    // is a reload, not a true close. The timer checks this flag before beaconing.
    try { localStorage.removeItem('_hp_unload_pending'); } catch { /* ignore */ }

    // Retry up to 2 times for 5xx / network errors (Render cold-start can
    // return 502/503 for ~30 s while the container wakes up). Never retry
    // on 401/403 — those are genuine auth failures and must not be masked.
    //
    // Uses the same 'hp-token-refresh' Web Lock as refreshToken() so that
    // a tab opening while another tab is mid-refresh doesn't send two
    // simultaneous /auth/refresh requests with the same RT cookie.
    // Loop-based (not recursive) to avoid re-acquiring the lock on retries.
    async function hydrate() {
      const doHydrate = async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (controller.signal.aborted) return;
          try {
            const res = await fetch(`${HP_API_BASE}/auth/refresh`, {
              method:      'POST',
              credentials: 'include',
              headers:     { 'x-api-key': import.meta.env.VITE_API_KEY },
              signal:      controller.signal,
            });

            if (res.ok) {
              const data = await res.json();
              accessTokenRef.current = data.accessToken || null;
              if (data.sk)   sessionKeyRef.current = data.sk;
              if (data.user) setUser(data.user);
              console.info('[Auth] hydrate OK — session restored');
              return;
            }

            if (res.status >= 500 && attempt < 2) {
              console.warn('[Auth] hydrate — server error', res.status, '— retrying (attempt', attempt + 1, ')');
              await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
            } else {
              accessTokenRef.current = null;
              sessionKeyRef.current  = null;
              const body = await res.json().catch(() => ({}));
              console.warn('[Auth] hydrate FAILED — status', res.status, 'code', body.code ?? '—');
              return;
            }
          } catch (err) {
            if (err.name === 'AbortError') return;
            if (attempt < 2) {
              console.warn('[Auth] hydrate — network error, retrying (attempt', attempt + 1, '):', err.message);
              await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
            } else {
              accessTokenRef.current = null;
              sessionKeyRef.current  = null;
              console.error('[Auth] hydrate ERROR —', err.message);
            }
          }
        }
      };

      try {
        if (typeof navigator !== 'undefined' && navigator.locks) {
          await navigator.locks.request('hp-token-refresh', doHydrate);
        } else {
          await doHydrate();
        }
      } finally {
        if (!controller.signal.aborted) setIsReady(true);
      }
    }

    hydrate();
    return () => { controller.abort(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab-close beacon ──────────────────────────────────────────────
  // Send a revoke beacon ONLY on true tab/window close, NOT on refresh.
  //
  // ROOT CAUSE OF REDIRECT-ON-REFRESH BUG:
  // The original code used 'beforeunload' which fires on F5/Ctrl+R too.
  // This revoked the refresh token BEFORE the page reloaded, so the
  // hydrate() call above always got 401 → token = null → redirect to "/".
  //
  // THE FIX — pagehide + localStorage handshake:
  // 'pagehide' fires on both close AND refresh. We write a flag to
  // localStorage and delay the beacon by 500ms. On a page reload the NEW
  // page's mount effect (above) removes that flag before the timer fires.
  // When the timer fires it checks: if the flag is gone → it was a reload,
  // skip the beacon. If the flag is still there → true close, send beacon.
  //
  // Why localStorage instead of the old focus-cancel approach:
  // The previous 'focus' handler was on the OLD window. On refresh the old
  // window is torn down before it can receive a focus event, so the cancel
  // never fired on Safari and some Chromium builds → beacon was sent →
  // refresh token revoked → hydrate() got 401 → redirect to login.
  useEffect(() => {
    let revokeTimer = null;

    function handlePageHide(e) {
      if (e.persisted) return;
      const token = accessTokenRef.current;
      if (!token) return;

      try { localStorage.setItem('_hp_unload_pending', '1'); } catch { /* ignore */ }

      revokeTimer = setTimeout(() => {
        revokeTimer = null;
        // If the new page already mounted, it cleared this flag → reload, skip.
        try {
          if (!localStorage.getItem('_hp_unload_pending')) return;
          localStorage.removeItem('_hp_unload_pending');
        } catch { /* ignore */ }

        const blob = new Blob(
          [JSON.stringify({ token })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(`${HP_API_BASE}/auth/revoke-token`, blob);
      }, 500);
    }

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
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

export default AuthContext;
