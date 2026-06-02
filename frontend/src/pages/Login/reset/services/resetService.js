/**
 * resetService.js
 * Fetch calls for the password-reset flow.
 * Mirrors the pattern in Login/services/authService.js.
 *
 * Base URL is read from VITE_API_BASE (set in your .env file):
 *   VITE_API_BASE=https://your-app.onrender.com
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? 'https://hostpilot-smoobu.onrender.com';

/**
 * verifyResetToken — POST /auth/verify-reset-token
 * @param {string} email
 * @param {string} token
 * @returns {Promise<{ valid: boolean }>}
 */
export async function verifyResetToken(email, token) {
  const res = await fetch(`${API_BASE}/auth/verify-reset-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_API_KEY,
    },
    body: JSON.stringify({ email, token }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Code verification failed.');
  }

  return data;
}

/**
 * resendReset — POST /auth/resend-reset
 * @param {string} email
 * @returns {Promise<{ message: string }>}
 */
export async function resendReset(email) {
  const res = await fetch(`${API_BASE}/auth/resend-reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_API_KEY,
    },
    body: JSON.stringify({ email }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Unable to resend reset code.');
  }

  return data;
}

/**
 * resetPassword — POST /auth/reset-password
 * @param {{ email: string, token: string, newPassword: string }} payload
 * @returns {Promise<{ message: string }>}
 * @throws {Error} with a user-facing message on failure
 */
export async function resetPassword({ email, token, newPassword }) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY },
    body: JSON.stringify({ email, token, newPassword }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Password reset failed.');
  }

  return data;
}
