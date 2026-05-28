/**
 * authorization/services/authService.js
 * ─────────────────────────────────────────────────────
 * API calls for OTP verification and resend.
 *
 * Reads base URL from:
 *   VITE_API_URL  (e.g. http://localhost:3001)
 *
 * Endpoints expected from the backend:
 *   POST /auth/verify-otp   { otp: string }  → 200 | 401
 *   POST /auth/resend-otp   {}               → 200 | 429
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/**
 * Verify a 6-digit OTP code.
 * @param {string} otp
 * @returns {Promise<object>} server response body
 * @throws {Error} with server message on failure
 */
export async function verifyOtp(otp) {
  const res = await fetch(`${API_BASE}/auth/verify-otp`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ otp }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Invalid or expired code.');
  }

  return res.json();
}

/**
 * Request a new OTP to be sent to the registered email.
 * @returns {Promise<object>} server response body
 * @throws {Error} with server message on failure
 */
export async function resendOtp() {
  const res = await fetch(`${API_BASE}/auth/resend-otp`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Unable to resend code. Try again later.');
  }

  return res.json();
}
