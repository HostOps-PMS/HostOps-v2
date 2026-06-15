import { authHeaders } from '../../../lib/authUtils';

export async function updateAdminProfile({ firstName, lastName }) {
  const res = await fetch('/auth/profile', {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({ firstName, lastName }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to update profile.');
  return data;
}