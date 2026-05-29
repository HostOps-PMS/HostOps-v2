const API_KEY = import.meta.env.VITE_API_KEY ?? '';

function getToken() {
  return sessionStorage.getItem('hp_access_token') ?? '';
}

export async function updateAdminProfile({ firstName, lastName }) {
  const res = await fetch('/auth/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      Authorization: `Bearer ${getToken()}`,
    },
    credentials: 'include',
    body: JSON.stringify({ firstName, lastName }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to update profile.');
  return data;
}