import { fetchWithAuth } from '../../../lib/authUtils';

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

export function fetchDisabledAppeals() {
  return request('/api/recovery-requests?status=pending&requestType=account_disabled');
}

export function resolveAppeal(id, { status, enableAccount = false, resolvedNote = '' } = {}) {
  return request(`/api/recovery-requests/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify({ status, enableAccount, resolvedNote }),
  });
}
