const API_KEY = import.meta.env.VITE_API_KEY ?? '';
const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? '';

function getToken() {
  return sessionStorage.getItem('hp_access_token') ?? '';
}

function getUser() {
  try {
    return JSON.parse(sessionStorage.getItem('hp_user') || 'null');
  } catch {
    return null;
  }
}

function setUser(user) {
  if (user == null) {
    sessionStorage.removeItem('hp_user');
  } else {
    sessionStorage.setItem('hp_user', JSON.stringify(user));
  }
}

async function fetchWithAuth(url, options = {}) {
  const token = getToken();
  const headers = {
    'x-api-key': API_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  return fetch(url, { ...options, headers });
}

export function useAuth() {
  return { getToken, getUser, setUser, fetchWithAuth };
}
