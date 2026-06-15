import { getToken, authHeaders as buildAuthHeaders } from './lib/authUtils';

const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? '';

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
  const headers = {
    ...buildAuthHeaders(),
    ...(options.headers || {}),
  };
  return fetch(url, { ...options, headers });
}

export function useAuth() {
  return { getToken, getUser, setUser, fetchWithAuth };
}
