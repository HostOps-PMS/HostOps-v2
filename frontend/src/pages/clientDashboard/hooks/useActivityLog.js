import { useAuth } from '../../AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export function useActivityLog() {
  const auth = useAuth();

  async function logActivity(action, meta = {}) {
    try {
      const token = auth.getToken();
      await fetch(`${API_BASE}/auth/log-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_KEY,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action, meta }),
      });
    } catch (e) {
      // Silent fail — activity logging should never break the UI
    }
  }

  return { logActivity };
}