const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function resetPassword(email, token, newPassword) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Password reset failed');
  return data;
}
