const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function fetchClientAnnouncements(auth) {
  try {
    const res = await auth.fetchWithAuth(`${API_BASE}/api/announcements/client`);
    if (!res) return [];
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[announcements] fetch failed status:', res.status, 'error:', body?.error);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[announcements] error:', err);
    return [];
  }
}
