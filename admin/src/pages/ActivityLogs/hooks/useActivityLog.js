import { authHeaders } from '../../../lib/authUtils';

const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? '';

export function useActivityLog() {
  async function logActivity(action, meta = {}) {
    try {
      await fetch(`${API_BASE}/api/activity-log`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action, meta }),
      });
    } catch {
      // fire-and-forget — never block the UI on log failures
    }
  }

  return { logActivity };
}
