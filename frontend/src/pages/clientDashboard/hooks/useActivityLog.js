import { useAuth } from '../../AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? "https://hostpilot-smoobu.onrender.com";

export function useActivityLog() {
  const { fetchWithAuth } = useAuth();

  async function logActivity(action, meta = {}) {
    try {
      await fetchWithAuth(`${API_BASE}/api/activity-log`, {
        method: 'POST',
        body: JSON.stringify({ action, meta }),
      });
    } catch (e) {
      // Silent fail — activity logging should never break the UI
    }
  }

  return { logActivity };
}