// src/pages/clientAccount/services/clientAccountService.js
// ─────────────────────────────────────────────────────────────────
// All API calls for the ClientAccount page.
// Mirrors the pattern used in the Staffs page services.
// ─────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_URL || 'https://hostpilot-smoobu.onrender.com';
const API_KEY = import.meta.env.VITE_API_KEY || '';

function authHeaders() {
  const token = sessionStorage.getItem('hp_access_token');
  return {
    'Content-Type': 'application/json',
    ...(token    && { Authorization: `Bearer ${token}` }),
    ...(API_KEY  && { 'x-api-key': API_KEY }),
  };
}

async function handleResponse(res) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

// ── Client Accounts ───────────────────────────────────────────────

export async function fetchClientAccounts(parentClientId = '') {
  const qs = parentClientId ? `?parentClientId=${parentClientId}` : '';
  const res = await fetch(`${BASE}/api/client-accounts${qs}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function createClientAccount(payload) {
  const res = await fetch(`${BASE}/api/client-accounts`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateClientAccount(id, payload) {
  const res = await fetch(`${BASE}/api/client-accounts/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteClientAccount(id) {
  const res = await fetch(`${BASE}/api/client-accounts/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ── Parent Clients (for the dropdown) ────────────────────────────

export async function fetchClients() {
  const res = await fetch(`${BASE}/api/clients`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ── Smoobu Properties for a parent client ────────────────────────
// Reuses the same endpoint as Staffs: GET /api/clients/:clientId/properties

export async function fetchClientProperties(clientId) {
  const res = await fetch(`${BASE}/api/clients/${clientId}/properties`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}
