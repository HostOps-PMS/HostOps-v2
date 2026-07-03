/**
 * authorization/services/authService.js
 * ─────────────────────────────────────────────────────
 * API calls for OTP verification and resend.
 *
 * In local dev, Vite proxy forwards /auth/* → backend.
 * In production (core.hostops.online), we use the absolute
 * backend URL from VITE_API_URL env variable.
 *
 * Endpoints on the backend:
 *   POST /auth/verify-login-otp  { email, otp, deviceId, rememberMe }
 *   POST /auth/resend-login-otp  { email }
 *   POST /auth/send-login-otp    { email }
 */

import { fetchWithAuth } from '../../../lib/authUtils';
import { getSecureUser } from '../../../lib/secureUserStorage';

const API_KEY  = import.meta.env.VITE_API_KEY ?? '';
const API_BASE = import.meta.env.VITE_API_URL ?? '';

/**
 * Resolves the correct base URL for auth endpoints.
 * - Local dev: relative path (Vite proxy handles it)
 * - Production: absolute URL from VITE_API_URL
 */
function authUrl(path) {
  return `${API_BASE}${path}`;
}

/**
 * Get the admin email stored in sessionStorage after login.
 * Returns an empty string if not found.
 */
function getAdminEmail() {
  try {
    const userObj = getSecureUser();
    const raw = userObj ? JSON.stringify(userObj) : null;
    if (!raw) return '';
    return JSON.parse(raw)?.email ?? '';
  } catch {
    return '';
  }
}

/**
 * Get (or generate) a stable device ID from localStorage.
 */
function getDeviceId() {
  let id = localStorage.getItem('hp_device_id');
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);
    localStorage.setItem('hp_device_id', id);
  }
  return id;
}

/**
 * Verify a 6-digit OTP code for the admin's current session.
 * @param {string} otp
 * @param {boolean} [rememberMe=false] - Whether to remember this device
 * @returns {Promise<object>} server response body
 * @throws {Error} with server message on failure
 */
export async function verifyOtp(otp, rememberMe = false) {
  const email    = getAdminEmail();
  const deviceId = getDeviceId();

  const res = await fetch(authUrl('/auth/verify-login-otp'), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'X-App-Client': 'admin' },
    credentials: 'include',
    body: JSON.stringify({ email, otp, deviceId, rememberMe }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(body.error ?? body.message ?? 'Invalid or expired code.');
    err.status = res.status;
    if (res.status === 429) {
      err.retryAfter = parseInt(res.headers.get('Retry-After'), 10) || 90;
    }
    throw err;
  }

  return body;
}

/**
 * Request a new OTP to be sent to the admin's registered email.
 * @returns {Promise<object>} server response body
 * @throws {Error} with server message on failure
 */
export async function resendOtp() {
  const email = getAdminEmail();

  const res = await fetch(authUrl('/auth/resend-login-otp'), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'X-App-Client': 'admin' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.error ?? body.message ?? 'Unable to resend code. Try again later.');
  }

  return body;
}

/**
 * Trigger the initial OTP email when the AuthModal first mounts.
 * @returns {Promise<object>}
 * @throws {Error}
 */
export async function sendLoginOtp() {
  const email = getAdminEmail();
  if (!email) return; // No email yet — user hasn't come from the login redirect

  const res = await fetch(authUrl('/auth/send-login-otp'), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'X-App-Client': 'admin' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.error ?? body.message ?? 'Failed to send OTP.');
  }

  return body;
}

/**
 * Check if the current device is trusted ("Remember Me" was set previously).
 * @returns {Promise<boolean>} true if device is trusted
 */
export async function checkTrustedDevice() {
  const email    = getAdminEmail();
  const deviceId = getDeviceId();
  if (!email || !deviceId) return false;

  try {
    const res = await fetch(authUrl('/auth/check-trusted-device'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'X-App-Client': 'admin' },
      credentials: 'include',
      body: JSON.stringify({ email, deviceId }),
    });
    const body = await res.json().catch(() => ({}));
    return body.trusted === true;
  } catch {
    return false;
  }
}

export async function getTotpStatus() {
  try {
    const userObj = getSecureUser();
    const raw = userObj ? JSON.stringify(userObj) : null;
    const user = raw ? JSON.parse(raw) : {};
    return { totpEnabled: user?.totpEnabled ?? false };
  } catch {
    return { totpEnabled: false };
  }
}

export async function verifyTotp(token) {
  const email = getAdminEmail();

  const res = await fetch(authUrl('/auth/totp/verify'), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'X-App-Client': 'admin' },
    credentials: 'include',
    body: JSON.stringify({ email, token }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error ?? 'Invalid code. Please try again.');
    err.status = res.status;
    if (res.status === 429) {
      err.retryAfter = parseInt(res.headers.get('Retry-After'), 10) || 90;
    }
    throw err;
  }
  return body;
}

export async function logoutUser() {
  try {
    await fetch(authUrl('/auth/logout'), {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
    });
  } catch (e) {
    console.error('Logout failed to reach server:', e);
  }
}