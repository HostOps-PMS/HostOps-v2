// frontend/src/pages/apiService.js
const HP_API_BASE = import.meta.env.VITE_API_BASE || 'https://hostpilot-smoobu.onrender.com';

/**
 * Authenticated fetch wrapper. Reads token from memory (AuthContext),
 * retries once after silent refresh on 401.
 *
 * @param {string} path    - API path, e.g. "/api/dashboard"
 * @param {object} options - Standard fetch options
 * @param {object} auth    - Auth helpers from AuthContext
 * @returns {Response|null} null when the session cannot be recovered
 */
export async function authFetch(path, options = {}, auth) {
  const token = auth.getToken();
  if (!token) return null;

  const opts = {
    ...options,
    credentials: 'include',   // always send cookies (refresh token)
    headers: {
      'Content-Type': 'application/json',
      'x-api-key':    import.meta.env.VITE_API_KEY,
      ...(options.headers || {}),
      Authorization:  `Bearer ${token}`,
    },
  };

  let res = await fetch(`${HP_API_BASE}${path}`, opts);

  // ── Silent refresh on 401 ────────────────────────────────────────
  if (res.status === 401) {
    const refreshed = await tryRefresh(auth);
    if (refreshed) {
      // Retry with the new token
      opts.headers.Authorization = `Bearer ${auth.getToken()}`;
      res = await fetch(`${HP_API_BASE}${path}`, opts);
    } else {
      auth.clear();
      return null;
    }
  }

  return res;
}

/**
 * Attempts a silent token refresh using the HttpOnly refresh cookie.
 * Stores the new encrypted access token in memory via auth.setToken().
 * Also updates the stored user if the refresh response includes it.
 */
export async function tryRefresh(auth) {
  try {
    const res = await fetch(`${HP_API_BASE}/auth/refresh`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'x-api-key': import.meta.env.VITE_API_KEY },
    });
    if (!res.ok) return false;

    const data = await res.json();
    auth.setToken(data.accessToken);

    if (data.user) auth.setUser(data.user);
    return true;
  } catch {
    return false;
  }
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

    // Access token expired — try a silent refresh then re-validate
    const refreshed = await tryRefresh(auth);
    if (!refreshed) { auth.clear(); return null; }

    const res2 = await fetch(`${HP_API_BASE}/auth/me`, {
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${auth.getToken()}`,
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
 */
export async function fetchMessages(reservationId, auth) {
  return authFetch(`/api/messages/${reservationId}`, {}, auth);
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