import { getToken, setSessionKey, fetchWithAuth as coreFetchWithAuth } from './lib/authUtils';

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

export function useAuth() {
  return { getToken, getUser, setUser, setSessionKey, fetchWithAuth: coreFetchWithAuth };
}
