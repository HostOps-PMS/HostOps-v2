import { useAuth } from '../../AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export function useActivityLog() {
  const { fetchWithAuth } = useAuth();

  async function logActivity(action, meta = {}) {
    try {
      await fetchWithAuth(`${API_BASE}/api/activity-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_KEY,
        },
        body: JSON.stringify({ action, meta }),
      });
    } catch (e) {
      // Silent fail — activity logging should never break the UI
    }
  }

  return { logActivity };
}