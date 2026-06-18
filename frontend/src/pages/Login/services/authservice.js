// frontend/src/pages/Login/services/authservice.js
import safeStorage from '../../safeStorage';
import { removeSecureUser } from '../../../lib/secureUserStorage';
import fpPromise from '@fingerprintjs/fingerprintjs';

let fpCache = null;
async function getDeviceFingerprint() {
  if (fpCache) return fpCache;
  try {
    const fp = await fpPromise.load();
    const result = await fp.get();
    fpCache = result.visitorId;
    return fpCache;
  } catch (e) {
    return 'unknown';
  }
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.hostops.online';

// ─────────────────────────────────────────────────────────────────
// loginUser
// Returns { accessToken, user | staff, requiresOtp?, isStaff? }
// Caller is responsible for auth.setToken(data.accessToken).
// ─────────────────────────────────────────────────────────────────
export async function loginUser({ email, password, deviceId }) {
  const fpHash = await getDeviceFingerprint();
  const res = await fetch(`${API_BASE}/auth/login`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 
      'Content-Type': 'application/json', 
      'x-api-key': import.meta.env.VITE_API_KEY,
      'x-device-fp': fpHash
    },
    body:        JSON.stringify({ email, password, deviceId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

// ─────────────────────────────────────────────────────────────────
// verifyLoginOtp
// Returns { accessToken, user, isAdmin }
// ─────────────────────────────────────────────────────────────────
export async function verifyLoginOtp({ email, otp, deviceId, rememberMe }) {
  const res = await fetch(`${API_BASE}/auth/verify-login-otp`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY },
    body:        JSON.stringify({ email, otp, deviceId, rememberMe }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'OTP verification failed');
    err.status = res.status;
    if (res.status === 429) {
      err.retryAfter = parseInt(res.headers.get('Retry-After'), 10) || 90;
    }
    throw err;
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────
// staffLogin
// Returns { accessToken, staff, mustChangePassword, mustChangePin }
// ─────────────────────────────────────────────────────────────────
export async function staffLogin({ email, password }) {
  const res = await fetch(`${API_BASE}/auth/staff-login`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY },
    body:        JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Staff login failed');
  return data;
}

// ─────────────────────────────────────────────────────────────────
// registerUser
// ─────────────────────────────────────────────────────────────────
export async function registerUser({ firstName, lastName, email, password, smoobuApiKey = '', propertyTagPrefix = '' }) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY },
    body:    JSON.stringify({ firstName, lastName, email, password, smoobuApiKey, propertyTagPrefix }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

// ─────────────────────────────────────────────────────────────────
// forgotPassword
// ─────────────────────────────────────────────────────────────────
export async function forgotPassword({ email }) {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY },
    body:    JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ─────────────────────────────────────────────────────────────────
// checkSession
// Tries the in-memory token first (passed in), then falls back to
// silent refresh via the HttpOnly cookie.
// Returns true if session is valid.
// ─────────────────────────────────────────────────────────────────
export async function checkSession(currentToken) {
  // If caller passes a current in-memory token, try it first
  if (currentToken) {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${currentToken}`,
        'x-api-key':   import.meta.env.VITE_API_KEY,
      },
    });
    if (res.ok) return true;
  }

  // Attempt silent refresh via HttpOnly cookie.
  // Uses the same 'hp-token-refresh' Web Lock as AuthContext so this
  // call cannot race with hydrate() or refreshToken() in another tab.
  const doRefresh = async () => {
    try {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'x-api-key': import.meta.env.VITE_API_KEY },
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        return data.accessToken || true;
      }
    } catch (error) {
      console.error('Silent refresh failed:', error);
    }
    return false;
  };

  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('hp-token-refresh', doRefresh);
  }
  return doRefresh();
}

// ─────────────────────────────────────────────────────────────────
// logoutUser
// Sends the current access token in the Authorization header so
// the server can revoke its jti. The HttpOnly 'rt' cookie is sent
// automatically via credentials:'include' for refresh token revocation.
// Clears all local state after server call (whether it succeeds or not).
// ─────────────────────────────────────────────────────────────────
export async function logoutUser(currentToken) {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method:      'POST',
      credentials: 'include',   // sends 'rt' cookie for refresh token revocation
      headers: {
        'Content-Type': 'application/json',
        'x-api-key':    import.meta.env.VITE_API_KEY,
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      },
    });
  } catch (err) {
    console.warn('Logout request failed:', err);
  } finally {
    // Wipe all client-side auth state regardless of server response
    removeSecureUser();
    try { localStorage.removeItem('user'); } catch { /* ignore */ }
    try { localStorage.removeItem('auth_user'); } catch { /* ignore */ }
    try { localStorage.removeItem('currentUser'); } catch { /* ignore */ }
    try { localStorage.removeItem('hostpilot_user'); } catch { /* ignore */ }
    try { sessionStorage.removeItem('hp_must_change_password'); } catch { /* ignore */ }
    try { sessionStorage.removeItem('hp_must_change_pin'); } catch { /* ignore */ }
    try { sessionStorage.removeItem('hp_selected_property_id'); } catch { /* ignore */ }
  }
}

// ─────────────────────────────────────────────────────────────────
// changePassword
// Requires the current in-memory token.
// ─────────────────────────────────────────────────────────────────
export async function changePassword({ currentPassword, newPassword }, currentToken) {
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method:      'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key':    import.meta.env.VITE_API_KEY,
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Password change failed');
  return data;
}

// ─────────────────────────────────────────────────────────────────
// verifyTotpLogin
// Called after email OTP when the user has TOTP enabled.
// Returns { accessToken, user, isAdmin } — same shape as verifyLoginOtp.
// ─────────────────────────────────────────────────────────────────
export async function verifyTotpLogin({ email, token }) {
  const res = await fetch(`${API_BASE}/auth/totp/verify`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY },
    body:        JSON.stringify({ email, token }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Invalid authenticator code');
    err.status = res.status;
    if (res.status === 429) {
      err.retryAfter = parseInt(res.headers.get('Retry-After'), 10) || 90;
    }
    throw err;
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────
// changePin
// ─────────────────────────────────────────────────────────────────
export async function changePin({ currentPin, newPin }, currentToken) {
  const res = await fetch(`${API_BASE}/auth/change-pin`, {
    method:      'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key':    import.meta.env.VITE_API_KEY,
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    },
    body: JSON.stringify({ currentPin, newPin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'PIN change failed');
  return data;
}