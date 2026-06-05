const API_BASE = import.meta.env.VITE_API_URL || 'https://hostpilot-smoobu.onrender.com';

export async function loginUser({ email, password, deviceId }) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY },
    body: JSON.stringify({ email, password, deviceId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function verifyLoginOtp({ email, otp, deviceId, rememberMe }) {
  const res = await fetch(`${API_BASE}/auth/verify-login-otp`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY },
    body: JSON.stringify({ email, otp, deviceId, rememberMe }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'OTP verification failed');
  return data;
}

// ─────────────────────────────────────────────────────────────────
// staffLogin
//
// Authenticates a staff member against POST /auth/staff-login.
// Returns { accessToken, staff, mustChangePassword, isStaff: true }.
// The caller (DomainLoginForm) is responsible for checking that
// staff.propertyIds includes the property selected in PropertySelectForm
// before proceeding to the dashboard.
// ─────────────────────────────────────────────────────────────────
export async function staffLogin({ email, password }) {
  const res = await fetch(`${API_BASE}/auth/staff-login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Staff login failed');
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
    headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY },
    body: JSON.stringify({ firstName, lastName, email, password, smoobuApiKey, propertyTagPrefix }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export async function forgotPassword({ email }) {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY },
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
      headers: { Authorization: `Bearer ${token}`, 'x-api-key': import.meta.env.VITE_API_KEY },
    });
    if (res.ok) return true;
  }
  
  // If access token is missing or expired, attempt silent refresh via HttpOnly cookie
  try {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Crucial to send the HttpOnly 'rt' cookie
      headers: { 'x-api-key': import.meta.env.VITE_API_KEY },
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

// POST /auth/logout
// Invalidates the refresh token cookie on the server, then clears all
// client-side tokens so the user is fully signed out.
export async function logoutUser() {
  try {
    const token = sessionStorage.getItem('hp_access_token');
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include', // sends the HttpOnly 'rt' cookie so the server can revoke it
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_API_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (err) {
    // Even if the server call fails, proceed with local cleanup
    console.warn('Logout request failed:', err);
  } finally {
    // Clear all client-side auth state regardless of server response
    sessionStorage.removeItem('hp_access_token');
    sessionStorage.removeItem('hp_must_change_password');
    sessionStorage.removeItem('hp_selected_property_id');
    localStorage.removeItem('hp_user');
    localStorage.removeItem('user');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('hostpilot_user');
  }
}

// POST /auth/change-password
// Called on first login when mustChangePassword is true.
// On success the backend sets isVerified: true and mustChangePassword: false.
export async function changePassword({ currentPassword, newPassword }) {
  const token = sessionStorage.getItem('hp_access_token');
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_API_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Password change failed');
  return data;
}