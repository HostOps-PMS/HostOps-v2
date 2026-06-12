const BASE    = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? 'https://hostpilot-smoobu.onrender.com';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

function authHeaders() {
  const token = sessionStorage.getItem('hp_access_token');
  return {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    ...(token   ? { Authorization: `Bearer ${token}` } : {}),
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

export function fetchDisabledAppeals() {
  return request('/api/recovery-requests?status=pending&requestType=account_disabled');
}

export function resolveAppeal(id, { status, enableAccount = false, resolvedNote = '' } = {}) {
  return request(`/api/recovery-requests/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify({ status, enableAccount, resolvedNote }),
  });
}
