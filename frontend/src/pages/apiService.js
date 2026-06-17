// frontend/src/pages/apiService.js
import { decryptApiResponse, generateSessionHint } from './utils/responseDecryption';

const HP_API_BASE = import.meta.env.VITE_API_URL || 'https://api.hostops.online';

// Wraps a fetch Response so .json() transparently decrypts encrypted envelopes.
function withDecryption(res, auth) {
  const sk = auth?.getSessionKey?.();
  if (!sk) return res;
  const originalJson = res.json.bind(res);
  res.json = async () => {
    const raw = await originalJson();
    if (raw && raw.e === 1) return decryptApiResponse(raw, sk);
    return raw;
  };
  return res;
}

/**
 * Authenticated fetch wrapper. Reads token from memory (AuthContext),
 * retries once after silent refresh on 401.
 */
export async function authFetch(path, options = {}, auth) {
  const token = auth.getToken();
  if (!token) return null;

  const hint = await generateSessionHint(auth.getSessionKey?.()).catch(() => null);

  const opts = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key':    import.meta.env.VITE_API_KEY,
      ...(options.headers || {}),
      Authorization:  `Bearer ${token}`,
      ...(hint ? { 'X-Session-Hint': hint } : {}),
    },
  };

  let res = await fetch(`${HP_API_BASE}${path}`, opts);

  if (res.status === 401) {
    const newToken = await auth.refreshToken();
    if (newToken) {
      const newHint = await generateSessionHint(auth.getSessionKey?.()).catch(() => null);
      opts.headers.Authorization = `Bearer ${newToken}`;
      if (newHint) opts.headers['X-Session-Hint'] = newHint;
      res = await fetch(`${HP_API_BASE}${path}`, opts);
    } else {
      auth.clear();
      return null;
    }
  }

  return withDecryption(res, auth);
}

/**
 * Validates the stored token against /auth/me.
 * Returns the user object on success, null on failure.
 */
export async function verifySession(auth) {
  const token = auth.getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${HP_API_BASE}/auth/me`, {
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-key':   import.meta.env.VITE_API_KEY,
      },
    });

    if (res.ok) {
      const data = await res.json();
      const user = data.user || data;
      auth.setUser(user);
      return user;
    }

    const newToken = await auth.refreshToken();
    if (!newToken) { auth.clear(); return null; }

    const res2 = await fetch(`${HP_API_BASE}/auth/me`, {
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${newToken}`,
        'x-api-key':   import.meta.env.VITE_API_KEY,
      },
    });

    if (res2.ok) {
      const data = await res2.json();
      const user = data.user || data;
      auth.setUser(user);
      return user;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches dashboard data for a given date range and optional property filter.
 */
export async function fetchDashboard({ from, to, apartmentId, propertyDbId }, auth) {
  const params = new URLSearchParams();
  if (from)         params.set('from', from);
  if (to)           params.set('to', to);
  if (apartmentId)  params.set('apartmentId', String(apartmentId));
  if (propertyDbId) params.set('propertyDbId', String(propertyDbId));

  const query = params.toString() ? `?${params.toString()}` : '';
  return authFetch(`/api/dashboard${query}`, {}, auth);
}

/**
 * Fetches messages for a specific reservation.
 * Passes propertyDbId so the backend can inject the per-property Smoobu API key,
 * matching the same injection the dashboard route does for inbox threads.
 */
export async function fetchMessages(reservationId, auth) {
  let query = '';
  try {
    const propertyDbId = sessionStorage.getItem('hp_selected_property_id');
    if (propertyDbId) query = `?propertyDbId=${encodeURIComponent(propertyDbId)}`;
  } catch { /* sessionStorage blocked — proceed without propertyDbId */ }
  return authFetch(`/api/messages/${reservationId}${query}`, {}, auth);
}

/**
 * Sends a reply message for a reservation.
 */
export async function sendReply({ reservationId, subject, messageBody }, auth) {
  return authFetch('/api/messages/reply', {
    method: 'POST',
    body:   JSON.stringify({ reservationId, subject, messageBody }),
  }, auth);
}

/**
 * Updates the current user's profile (firstName, lastName, propertyTagPrefix).
 */
export async function updateProfile({ firstName, lastName, propertyTagPrefix }, auth) {
  return authFetch('/auth/profile', {
    method: 'PATCH',
    body:   JSON.stringify({ firstName, lastName, propertyTagPrefix }),
  }, auth);
}
