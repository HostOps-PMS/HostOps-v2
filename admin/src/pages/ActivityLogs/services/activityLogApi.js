// src/pages/ActivityLogs/services/activityLogApi.js

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getHeaders() {
  const token = sessionStorage.getItem('hp_access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Fetch all activity logs (admin only).
 * Supports pagination and filtering by userId, action, from, to.
 */
export async function fetchAllActivityLogs({
  page = 1,
  limit = 50,
  userId = '',
  action = '',
  from = '',
  to = '',
} = {}) {
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('limit', limit);
  if (userId) params.set('userId', userId);
  if (action)  params.set('action', action);
  if (from)    params.set('from', from);
  if (to)      params.set('to', to);

  const res = await fetch(`${BASE}/api/activity-log/all?${params.toString()}`, {
    headers: getHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to fetch activity logs (${res.status})`);
  }

  return res.json(); // { activityLog, pagination }
}

/**
 * Fetch all clients (for the business name filter dropdown).
 */
export async function fetchClients() {
  const res = await fetch(`${BASE}/api/clients`, {
    headers: getHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to fetch clients (${res.status})`);
  }

  return res.json(); // array of client objects
}
