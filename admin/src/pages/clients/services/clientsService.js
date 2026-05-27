/**
 * clientsService.js
 * All API calls scoped to the clients page.
 *
 * Base URL:  VITE_API_BASE_URL (see .env)
 * Auth:      Bearer token stored in sessionStorage as 'hp_access_token'
 * API Key:   VITE_API_KEY (see .env) — sent as x-api-key header
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

function authHeaders() {
  const token  = sessionStorage.getItem('hp_access_token');
  const apiKey = import.meta.env.VITE_API_KEY ?? '';
  return {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
    ...(token  ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...authHeaders(), ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err  = new Error(body.error ?? `API ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

/* ── Clients ────────────────────────────────────────────────── */

/**
 * GET /api/clients
 * Returns all registered users (admin-only endpoint).
 * @returns {Promise<User[]>}
 */
export async function getClients() {
  return request('/api/clients');
}

/**
 * GET /api/clients/:id
 * @param {string} id - MongoDB ObjectId string
 * @returns {Promise<User>}
 */
export async function getClient(id) {
  return request(`/api/clients/${id}`);
}

/**
 * POST /auth/register
 * Creates a new user account (admin-initiated).
 * Uses the standard register endpoint so password hashing,
 * verification email, and GHL webhook all fire normally.
 *
 * @param {{
 *   firstName: string,
 *   lastName?: string,
 *   email: string,
 *   password: string,
 *   role?: 'client' | 'admin',
 *   propertyTagPrefix?: string,
 *   smoobuApiKey?: string,
 * }} data
 * @returns {Promise<{ message: string, userId: string }>}
 */
export async function createClient(data) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

const clientsService = { getClients, getClient, createClient };
export default clientsService;