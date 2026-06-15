import { authHeaders, uploadHeaders } from '../../../lib/authUtils';

const BASE = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? 'https://hostpilot-smoobu.onrender.com';

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
export async function getClients({ archived = false } = {}) {
  return request(`/api/clients${archived ? '?archived=true' : ''}`);
}

export async function archiveClient(id) {
  return request(`/api/clients/${id}/archive`, { method: 'PATCH' });
}

export async function unarchiveClient(id) {
  return request(`/api/clients/${id}/unarchive`, { method: 'PATCH' });
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
 * GET /api/clients/:id/properties/:propertyId/apikey
 * Fetches the unmasked API key. Protected by OTP on the frontend.
 *
 * @param {string} clientId
 * @param {string} propertyId
 * @returns {Promise<{smoobuApiKey: string}>}
 */
export async function getClientPropertyApiKey(clientId, propertyId) {
  return request(`/api/clients/${clientId}/properties/${propertyId}/apikey`);
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
 * POST /api/clients/:id/properties/:propertyId/picture
 * Admin uploads an image for a property and/or updates the crop data.
 *
 * @param {string} clientId
 * @param {string} propertyId
 * @param {File|Blob|null} file
 * @param {Object} [cropData]
 * @returns {Promise<{ message: string, propertyPicture: string, propertyPictureOriginal: string, propertyPictureCropData: any }>}
 */
export async function uploadPropertyPicture(clientId, propertyId, file, cropData) {
  const formData = new FormData();
  if (file) formData.append('picture', file);
  if (cropData) formData.append('cropData', JSON.stringify(cropData));

  // Use raw fetch since we need to send FormData and NOT set Content-Type to application/json
  const res = await fetch(`${BASE}/api/clients/${clientId}/properties/${propertyId}/picture`, {
    method: 'POST',
    headers: uploadHeaders(),
    body: formData,
  });

  if (!res.ok) {
    let errorMsg = `API ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) errorMsg = body.error;
    } catch {
      // Response was not JSON (e.g., 502 HTML page from proxy)
      errorMsg = `Server error (${res.status})`;
    }
    const err = new Error(errorMsg);
    err.status = res.status;
    throw err;
  }

  return res.json();
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

/**
 * POST /api/accounts/apartment-photos/bulk
 * Fetches stored photos for multiple apartments in one DB query.
 *
 * @param {(string|number)[]} apartmentIds
 * @returns {Promise<{ photos: { [apartmentId: string]: { id: string|null, url: string }[] } }>}
 */
export async function getApartmentPhotosBulk(apartmentIds) {
  return request('/api/accounts/apartment-photos/bulk', {
    method: 'POST',
    body: JSON.stringify({ apartmentIds: apartmentIds.map(String) }),
  });
}

/**
 * GET /api/exchange-rate
 * Fetches the exchange rate from the backend proxy.
 *
 * @returns {Promise<{rates: {PHP: number}}>}
 */
export async function getExchangeRate() {
  return request(`/api/exchange-rate`);
}

const clientsService = {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  archiveClient,
  unarchiveClient,
  getClientProperties,
  createClientProperty,
  updateClientProperty,
  uploadPropertyPicture,
  syncPropertySubProperties,
  deleteClientProperty,
  getClientSmoobuData,
  getApartmentPhotosBulk,
  getExchangeRate,
};
export default clientsService;