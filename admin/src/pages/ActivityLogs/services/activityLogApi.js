import { fetchWithAuth as apiFetch } from '../../../lib/authUtils';

const BASE = import.meta.env.VITE_API_URL || 'https://api.hostops.online';

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

  const res = await apiFetch(`${BASE}/api/activity-log/all?${params.toString()}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to fetch activity logs (${res.status})`);
  }

  return res.json(); // { activityLog, pagination }
}

/**
 * Fetch ALL filtered activity logs for CSV export (no pagination cap).
 * Internally pages through all results using a large limit, respecting
 * the same userId / action / from / to filters as the table view.
 */
export async function exportActivityLogs({
  userId = '',
  action = '',
  from = '',
  to = '',
} = {}) {
  // Use the server's max limit (200) to minimise round-trips.
  const EXPORT_LIMIT = 200;
  let page = 1;
  let totalPages = 1;
  const allLogs = [];

  do {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', EXPORT_LIMIT);
    if (userId) params.set('userId', userId);
    if (action)  params.set('action', action);
    if (from)    params.set('from', from);
    if (to)      params.set('to', to);

    const res = await apiFetch(`${BASE}/api/activity-log/all?${params.toString()}`);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Failed to export activity logs (${res.status})`);
    }

    const data = await res.json(); // { activityLog, pagination }
    allLogs.push(...(data.activityLog || []));
    totalPages = data.pagination?.pages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return allLogs;
}

/**
 * Fetch all clients (for the business name filter dropdown).
 */
export async function fetchClients() {
  const res = await apiFetch(`${BASE}/api/clients`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to fetch clients (${res.status})`);
  }

  return res.json(); // array of client objects
}