const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || '/dashboard';

/**
 * Calls the real Express backend /auth/login endpoint.
 * Stores the JWT access token returned by the server.
 */
export async function login({ email, password }) {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // needed for the refresh token cookie
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Invalid email or password.');
  }

  // data.accessToken is a real JWT — backend signs it with JWT_ACCESS_SECRET
  return {
    accessToken: data.accessToken,
    sk:   data.sk   ?? null,
    user: data.user || data.staff,
  };
}

/**
 * Calls GET /auth/me to verify the stored token is still valid on the backend.
 */
export async function checkSession(token) {
  if (!token || token === 'local-session') return false;

  try {
    const res = await fetch('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export { DASHBOARD_URL };