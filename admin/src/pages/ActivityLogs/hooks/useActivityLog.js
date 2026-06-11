const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? '';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

export function useActivityLog() {
  async function logActivity(action, meta = {}) {
    const token = sessionStorage.getItem('hp_access_token');
    try {
      await fetch(`${API_BASE}/api/activity-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action, meta }),
      });
    } catch {
      // fire-and-forget — never block the UI on log failures
    }
  }

  return { logActivity };
}
