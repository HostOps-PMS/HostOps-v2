/**
 * authorization/services/authService.js
 * ─────────────────────────────────────────────────────
 * API calls for OTP verification and resend.
 *
 * Uses relative URLs so the Vite dev-server proxy forwards
 * /auth/* → http://localhost:5000 (no port mismatch).
 *
 * Endpoints on the backend:
 *   POST /auth/verify-login-otp  { email, otp, deviceId, rememberMe }
 *   POST /auth/resend-login-otp  { email }
 */

const API_KEY = import.meta.env.VITE_API_KEY ?? '';

/**
 * Get the admin email stored in sessionStorage after login.
 * Returns an empty string if not found.
 */
function getAdminEmail() {
  try {
    const raw = sessionStorage.getItem('hp_user');
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
 * @returns {Promise<object>} server response body
 * @throws {Error} with server message on failure
 */
export async function verifyOtp(otp) {
  const email    = getAdminEmail();
  const deviceId = getDeviceId();

  const res = await fetch('/auth/verify-login-otp', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    credentials: 'include',
    body: JSON.stringify({ email, otp, deviceId, rememberMe: false }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.error ?? body.message ?? 'Invalid or expired code.');
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

  const res = await fetch('/auth/resend-login-otp', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
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
 * Uses the same GHL webhook as email verification.
 * @returns {Promise<object>}
 * @throws {Error}
 */
export async function sendLoginOtp() {
  const email = getAdminEmail();
  if (!email) return; // No email yet — user hasn't come from the login redirect

  const res = await fetch('/auth/send-login-otp', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.error ?? body.message ?? 'Failed to send OTP.');
  }

  return body;
}
