const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function loginUser({ email, password }) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function registerUser({
  firstName,
  lastName,
  email,
  password,
  smoobuApiKey = '',
  propertyTagPrefix = '',
}) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, lastName, email, password, smoobuApiKey, propertyTagPrefix }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export async function forgotPassword({ email }) {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export async function checkSession() {
  let token = sessionStorage.getItem('hp_access_token');
  
  // First try with existing access token
  if (token) {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return true;
  }
  
  // If access token is missing or expired, attempt silent refresh via HttpOnly cookie
  try {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Crucial to send the HttpOnly 'rt' cookie
    });
    
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      sessionStorage.setItem('hp_access_token', data.accessToken);
      return true;
    }
  } catch (error) {
    console.error('Silent refresh failed:', error);
  }
  
  return false;
}