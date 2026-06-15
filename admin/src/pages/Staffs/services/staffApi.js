import { authHeaders } from '../../../lib/authUtils';

const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? 'https://hostpilot-smoobu.onrender.com';

export function apiFetch(path, opts = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: authHeaders(opts.headers),
  });
}

export async function fetchStaffs(filterClient, { archived = false } = {}) {
  const params = new URLSearchParams();
  if (filterClient) params.set('clientId', filterClient);
  if (archived) params.set('archived', 'true');
  const query = params.toString();
  const url = `/api/staffs${query ? `?${query}` : ''}`;
  const res = await apiFetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load staffs.');
  return data;
}

export async function archiveStaff(id) {
  const res = await apiFetch(`/api/staffs/${id}/archive`, { method: 'PATCH' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to archive staff.');
  return data;
}

export async function unarchiveStaff(id) {
  const res = await apiFetch(`/api/staffs/${id}/unarchive`, { method: 'PATCH' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to unarchive staff.');
  return data;
}

export async function fetchClients() {
  const res = await apiFetch('/api/clients');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load clients.');
  return data;
}

export async function fetchClientProperties(clientId) {
  const res = await apiFetch(`/api/clients/${clientId}/staff-properties`);
  const data = await res.json();
  if (!res.ok) throw new Error('Failed to load properties.');
  return data;
}

export async function createStaff(body) {
  const res = await apiFetch('/api/staffs', { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export async function updateStaff(id, body) {
  const res = await apiFetch(`/api/staffs/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export async function deleteStaff(id) {
  const res = await apiFetch(`/api/staffs/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to delete.');
  }
}