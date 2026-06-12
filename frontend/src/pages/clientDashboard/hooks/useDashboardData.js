import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { useDashboard } from '../context/DashboardContext';
import { fetchDashboard } from '../services/dashboardService';
import safeStorage from '../../safeStorage';

// ── Why safeStorage? ──────────────────────────────────────────────────────────
// localStorage.getItem('hp_selected_property_id') was throwing a SecurityError
// on go.hostops.online, so propertyDbId was always null/undefined. Combined
// with DashboardContext also failing to read the stored property, this caused
// the dashboard to behave as if no property was ever selected — resulting in
// repeated API calls and the visible infinite-polling in the server logs
// (20+ identical /api/clients/{id}/properties requests per session).
// safeStorage.getItem never throws, returning null safely when no value exists.
// ─────────────────────────────────────────────────────────────────────────────

export function useDashboardData() {
  const auth = useAuth();
  const { dashState, updateDashState } = useDashboard();
  const [banner, setBanner] = useState({ message: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);

  const loadData = useCallback(async (fromOverride, toOverride, apartmentIdOverride) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);

    const from = fromOverride ?? dashState.from;
    const to   = toOverride   ?? dashState.to;

    // safeStorage.getItem never throws — returns null if key doesn't exist
    // or if storage is blocked (falls back to in-memory Map).
    const propertyDbId = safeStorage.getItem('hp_selected_property_id') || null;

    const apartmentId = apartmentIdOverride !== undefined ? apartmentIdOverride : null;

    setBanner({ message: '⏳ Loading data…', type: 'loading' });

    try {
      const res = await fetchDashboard({ from, to, apartmentId, propertyDbId }, auth);

      if (!res) {
        setBanner({ message: '⚠️ Session expired. Please sign in again.', type: 'error' });
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setBanner({ message: `⚠️ Could not load data: ${err.error || 'unknown error'}`, type: 'error' });
        return;
      }

      const data = await res.json();

      if (data.smoobuNotConnected) {
        updateDashState({ rawData: data });
        setBanner({ message: data.message || 'Connect your Smoobu account to see live data.', type: 'connect' });
        return;
      }

      updateDashState({ rawData: data });

      if (data.period) {
        updateDashState({ from: data.period.from, to: data.period.to });
      }

      setBanner({ message: 'Live data', type: 'live' });
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      updateDashState({ isSwitching: false });
    }
  }, [auth, dashState.from, dashState.to, dashState.selectedPropertyId, updateDashState]);

  return { loadData, banner, isLoading };
}