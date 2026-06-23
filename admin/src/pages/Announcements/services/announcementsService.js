import { fetchWithAuth, uploadHeaders } from '../../../lib/authUtils';

const BASE = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? 'https://api.hostops.online';

async function request(path, options = {}) {
  const res = await fetchWithAuth(`${BASE}${path}`, options);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err  = new Error(body.error ?? `API ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export async function getAnnouncements() {
  return request('/api/announcements');
}

export async function getAnnouncement(id) {
  return request(`/api/announcements/${id}`);
}

export async function createAnnouncement(data, imageFile) {
  const formData = new FormData();
  formData.append('title',    data.title);
  formData.append('content',  data.content);
  formData.append('audience', data.audience);
  formData.append('priority', data.priority);
  formData.append('status',   data.status);
  if (data.startDate) formData.append('startDate', data.startDate);
  if (data.endDate)   formData.append('endDate',   data.endDate);
  if (data.audience === 'selected' && data.targetClients?.length) {
    formData.append('targetClients', JSON.stringify(data.targetClients));
  }
  if (imageFile) formData.append('image', imageFile);

  const res = await fetch(`${BASE}/api/announcements`, {
    method:  'POST',
    headers: uploadHeaders(),
    body:    formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API ${res.status}`);
  }
  return res.json();
}

export async function updateAnnouncement(id, data, imageFile) {
  const formData = new FormData();
  if (data.title     !== undefined) formData.append('title',    data.title);
  if (data.content   !== undefined) formData.append('content',  data.content);
  if (data.audience  !== undefined) formData.append('audience', data.audience);
  if (data.priority  !== undefined) formData.append('priority', data.priority);
  if (data.status    !== undefined) formData.append('status',   data.status);
  if (data.startDate !== undefined) formData.append('startDate', data.startDate || '');
  if (data.endDate   !== undefined) formData.append('endDate',   data.endDate   || '');
  if (data.audience  !== undefined) {
    formData.append('targetClients', JSON.stringify(data.targetClients || []));
  }
  if (data.removeImage)             formData.append('removeImage', 'true');
  if (imageFile)                    formData.append('image', imageFile);

  const res = await fetch(`${BASE}/api/announcements/${id}`, {
    method:  'PATCH',
    headers: uploadHeaders(),
    body:    formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API ${res.status}`);
  }
  return res.json();
}

export async function deleteAnnouncement(id) {
  return request(`/api/announcements/${id}`, {
    method: 'DELETE',
  });
}
