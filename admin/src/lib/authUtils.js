import { decryptApiResponse, generateSessionHint } from './responseDecryption';

const API_KEY  = import.meta.env.VITE_API_KEY  ?? '';
const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? '';

// ── Token ──────────────────────────────────────────────────────────
export const getToken = () => sessionStorage.getItem('hp_access_token') ?? '';
export const setToken = (t) => {
  if (t) sessionStorage.setItem('hp_access_token', t);
  else   sessionStorage.removeItem('hp_access_token');
};

// ── Session key (for response decryption) ──────────────────────────
export const getSessionKey = () => sessionStorage.getItem('hp_session_key') ?? null;
export const setSessionKey = (sk) => {
  if (sk) sessionStorage.setItem('hp_session_key', sk);
  else    sessionStorage.removeItem('hp_session_key');
};

// ── Request headers ────────────────────────────────────────────────
export const authHeaders = (extra = {}) => ({
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
  Authorization: `Bearer ${getToken()}`,
  ...extra,
});

// For multipart/FormData — omits Content-Type so the browser sets the boundary
export const uploadHeaders = (extra = {}) => ({
  'x-api-key': API_KEY,
  Authorization: `Bearer ${getToken()}`,
  ...extra,
});

// ── Silent token refresh ───────────────────────────────────────────
async function tryRefresh() {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'x-api-key': API_KEY },
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.accessToken) setToken(data.accessToken);
    if (data.sk)          setSessionKey(data.sk);
    return !!data.accessToken;
  } catch {
    return false;
  }
}

// ── Wrap res.json() to transparently decrypt encrypted envelopes ───
function withDecryption(res) {
  const originalJson = res.json.bind(res);
  res.json = async () => {
    const raw = await originalJson();
    const sk  = getSessionKey();
    if (raw && raw.e === 1 && sk) return decryptApiResponse(raw, sk);
    return raw;
  };
  return res;
}

/**
 * Drop-in replacement for fetch() used by all admin service files.
 * Handles: auth headers, X-Session-Hint, 401 → silent refresh + retry,
 * and transparent AES-256-GCM response decryption.
 */
export async function fetchWithAuth(url, options = {}) {
  const sk   = getSessionKey();
  const hint = sk ? await generateSessionHint(sk).catch(() => null) : null;

  const buildHeaders = () => ({
    ...authHeaders(options.headers),
    ...(hint ? { 'X-Session-Hint': hint } : {}),
  });

  let res = await fetch(url, { ...options, headers: buildHeaders(), credentials: 'include' });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newSk   = getSessionKey();
      const newHint = newSk ? await generateSessionHint(newSk).catch(() => null) : null;
      res = await fetch(url, {
        ...options,
        headers: {
          ...authHeaders(options.headers),
          ...(newHint ? { 'X-Session-Hint': newHint } : {}),
        },
        credentials: 'include',
      });
    }
  }

  return withDecryption(res);
}
