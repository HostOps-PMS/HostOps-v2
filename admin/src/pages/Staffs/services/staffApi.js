const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

export function getToken() {
  return sessionStorage.getItem('hp_access_token') || '';
}

export function apiFetch(path, opts = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      'x-api-key': import.meta.env.VITE_API_KEY ?? '',
      ...(opts.headers || {}),
    },
  });
}

export async function fetchStaffs(filterClient) {
  const url = filterClient ? `/api/staffs?clientId=${filterClient}` : '/api/staffs';
  const res = await apiFetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load staffs.');
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