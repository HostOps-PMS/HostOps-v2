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
 * POST /api/clients
 * Admin creates a new user account with a temporary password.
 * Uses the dedicated admin endpoint (not /auth/register) so that
 * mustChangePassword is set to true — forcing the user to change
 * their password on first login before gaining full access.
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
 * @returns {Promise<{ message: string, userId: string, user: object }>}
 */
export async function createClient(data) {
  return request('/api/clients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * PATCH /api/clients/:id
 * Admin updates an existing client's editable fields.
 * Only role, propertyTagPrefix, and smoobuApiKey are accepted by the server.
 *
 * @param {string} id - MongoDB ObjectId string
 * @param {{
 *   role?: 'client' | 'admin',
 *   propertyTagPrefix?: string,
 *   smoobuApiKey?: string,
 * }} data
 * @returns {Promise<User>}
 */
export async function updateClient(id, data) {
  return request(`/api/clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * GET /api/clients/:id/smoobu
 * Admin fetches the Smoobu dashboard data for a specific client.
 * The server loads the client's smoobuApiKey server-side (never exposed
 * to the frontend) and proxies the Smoobu response back.
 *
 * @param {string} id              - MongoDB ObjectId string
 * @param {{ from?: string, to?: string }} [range] - Optional date range YYYY-MM-DD
 * @returns {Promise<SmoobuDashboard>}
 */
export async function getClientSmoobuData(id, { from, to } = {}) {
  const params = new URLSearchParams();
  if (from) params.append('from', from);
  if (to)   params.append('to',   to);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/clients/${id}/smoobu${qs}`);
}

const clientsService = { getClients, getClient, createClient, updateClient, getClientSmoobuData };
export default clientsService;