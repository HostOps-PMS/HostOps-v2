const API_BASE = import.meta.env.VITE_API_URL || 'https://api.hostops.online';

export async function verifyEmail(email, token) {
  const res = await fetch(`${API_BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY },
    body: JSON.stringify({ email, token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Verification failed');
  return data;
}

export async function resendVerification(email) {
  const res = await fetch(`${API_BASE}/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Resend failed');
  return data;
}
