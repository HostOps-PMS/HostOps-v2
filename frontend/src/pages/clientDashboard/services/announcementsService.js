const API_BASE = import.meta.env.VITE_API_URL || 'https://api.hostops.online';

export async function fetchClientAnnouncements(auth) {
  try {
    const res = await auth.fetchWithAuth(`${API_BASE}/api/announcements/client`);
    console.log('[announcements] res:', res?.status, res?.ok);
    if (!res || !res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[announcements] fetch failed status:', res?.status, 'error:', body?.error);
      return [];
    }
    const data = await res.json();
    console.log('[announcements] data:', data);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[announcements] error:', err);
    return [];
  }
}
