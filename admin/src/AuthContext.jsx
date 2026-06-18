import { getToken, setSessionKey, fetchWithAuth as coreFetchWithAuth } from './lib/authUtils';

import { getSecureUser, setSecureUser } from './lib/secureUserStorage';

function getUser() {
  return getSecureUser();
}

function setUser(user) {
  setSecureUser(user);
}

export function useAuth() {
  return { getToken, getUser, setUser, setSessionKey, fetchWithAuth: coreFetchWithAuth };
}
