const HP_API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

/**
 * Authenticated fetch wrapper. Automatically attaches Bearer token and
 * retries once after a silent token refresh on 401.
 *
 * @param {string} path   - API path, e.g. "/api/dashboard"
 * @param {object} options - Standard fetch options
 * @param {object} auth   - Auth helpers from AuthContext
 * @returns {Response|null} null when the session cannot be recovered
 */
export async function authFetch(path, options = {}, auth) {
  const token = auth.getToken();
  if (!token) return null;

  const opts = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
  };

  let res = await fetch(`${HP_API_BASE}${path}`, opts);

  if (res.status === 401) {
    const refreshed = await tryRefresh(auth);
    if (refreshed) {
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
 */
export async function tryRefresh(auth) {
  try {
    const res = await fetch(`${HP_API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    auth.setToken(data.accessToken);
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
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) return res.json();

    const refreshed = await tryRefresh(auth);
    if (!refreshed) {
      auth.clear();
      return null;
    }

    const res2 = await fetch(`${HP_API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${auth.getToken()}` },
    });
    return res2.ok ? res2.json() : null;
  } catch {
    return null;
  }
}

/**
 * Fetches dashboard data for a given date range.
 */
export async function fetchDashboard({ from, to }, auth) {
  const query = from && to ? `?from=${from}&to=${to}` : '';
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
    body: JSON.stringify({ reservationId, subject, messageBody }),
  }, auth);
}
