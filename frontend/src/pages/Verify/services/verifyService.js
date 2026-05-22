const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function verifyEmail(email, token) {
  const res = await fetch(`${API_BASE}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Verification failed');
  return data;
}
