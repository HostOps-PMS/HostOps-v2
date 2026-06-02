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
 * Note: Smoobu API keys are no longer set at account creation.
 * They are configured per-property via the property endpoints below.
 *
 * @param {{
 *   businessName: string,
 *   email: string,
 *   password: string,
 *   role?: 'client' | 'admin',
 *   propertyTagPrefix?: string,
 *   properties?: Array<{ propertyName: string, smoobuApiKey?: string }>,
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
 * Only role and propertyTagPrefix are accepted by the server.
 * Smoobu API keys are now managed per-property.
 *
 * @param {string} id - MongoDB ObjectId string
 * @param {{
 *   role?: 'client' | 'admin',
 *   propertyTagPrefix?: string,
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
 * DELETE /api/clients/:id
 * Admin deletes an existing client or team leader account.
 *
 * @param {string} id - MongoDB ObjectId string
 * @returns {Promise<{ message: string }>}
 */
export async function deleteClient(id) {
  return request(`/api/clients/${id}`, {
    method: 'DELETE',
  });
}

/* ── Properties ─────────────────────────────────────────────── */

/**
 * GET /api/clients/:id/properties
 * Returns all properties (with subProperties) belonging to a client.
 * smoobuApiKey is never returned.
 *
 * @param {string} clientId - MongoDB ObjectId string
 * @returns {Promise<Property[]>}
 */
export async function getClientProperties(clientId) {
  return request(`/api/clients/${clientId}/properties`);
}

/**
 * POST /api/clients/:id/properties
 * Admin adds an embedded property to a client's properties array.
 *
 * @param {string} clientId
 * @param {{
 *   propertyName: string,
 *   smoobuApiKey?: string,
 * }} data
 * @returns {Promise<Property>}
 */
export async function createClientProperty(clientId, data) {
  return request(`/api/clients/${clientId}/properties`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * PATCH /api/clients/:id/properties/:propertyId
 * Admin updates an embedded property's name or smoobuApiKey.
 *
 * @param {string} clientId
 * @param {string} propertyId
 * @param {{
 *   propertyName?: string,
 *   smoobuApiKey?: string,
 * }} data
 * @returns {Promise<Property>}
 */
export async function updateClientProperty(clientId, propertyId, data) {
  return request(`/api/clients/${clientId}/properties/${propertyId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * POST /api/clients/:id/properties/:propertyId/sync
 * Triggers a Smoobu sync for a property — fetches all rooms/units
 * (apartments) from Smoobu and stores them as subProperties.
 *
 * @param {string} clientId
 * @param {string} propertyId
 * @returns {Promise<{ message: string, count: number, subProperties: SubProperty[] }>}
 */
export async function syncPropertySubProperties(clientId, propertyId) {
  return request(`/api/clients/${clientId}/properties/${propertyId}/sync`, {
    method: 'POST',
  });
}

/**
 * DELETE /api/clients/:id/properties/:propertyId
 * Admin soft-deletes (deactivates) a property.
 *
 * @param {string} clientId
 * @param {string} propertyId
 * @returns {Promise<{ message: string }>}
 */
export async function deleteClientProperty(clientId, propertyId) {
  return request(`/api/clients/${clientId}/properties/${propertyId}`, {
    method: 'DELETE',
  });
}

/* ── Smoobu ─────────────────────────────────────────────────── */

/**
 * GET /api/clients/:id/smoobu?propertyId=<id>&from=<date>&to=<date>
 * Admin fetches the Smoobu dashboard data for a specific property.
 * The server loads the property's smoobuApiKey server-side (never
 * exposed to the frontend) and proxies the Smoobu response back.
 *
 * @param {string} clientId              - MongoDB ObjectId string (business account)
 * @param {string} propertyId            - MongoDB ObjectId string (property)
 * @param {{ from?: string, to?: string }} [range] - Optional date range YYYY-MM-DD
 * @returns {Promise<SmoobuDashboard>}
 */
export async function getClientSmoobuData(clientId, propertyId, { from, to } = {}) {
  const params = new URLSearchParams({ propertyId });
  if (from) params.append('from', from);
  if (to)   params.append('to',   to);
  return request(`/api/clients/${clientId}/smoobu?${params.toString()}`);
}

const clientsService = {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientProperties,
  createClientProperty,
  updateClientProperty,
  syncPropertySubProperties,
  deleteClientProperty,
  getClientSmoobuData,
};
export default clientsService;