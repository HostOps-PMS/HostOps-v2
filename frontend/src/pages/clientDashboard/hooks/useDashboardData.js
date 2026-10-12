import { useCallback, useState } from 'react';
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

// Shared by every useDashboardData() instance (DateFilterBar, dashboard index,
// InboxPage…): only the most recent request may write its result, so a slow
// response for an old date range can never overwrite a newer one. A request
// identical to the one already in flight is skipped (e.g. StrictMode remount).
let latestRequestId = 0;
let inflightKey = null;

export function useDashboardData() {
  const auth = useAuth();
  const { dashState, updateDashState } = useDashboard();
  const [banner, setBanner] = useState({ message: '', type: '' });

  const loadData = useCallback(async (fromOverride, toOverride, apartmentIdOverride) => {
    const from = fromOverride ?? dashState.from;
    const to   = toOverride   ?? dashState.to;

    // safeStorage.getItem never throws — returns null if key doesn't exist
    // or if storage is blocked (falls back to in-memory Map).
    const propertyDbId = safeStorage.getItem('hp_selected_property_id') || null;

    const apartmentId = apartmentIdOverride !== undefined ? apartmentIdOverride : null;

    const key = JSON.stringify([from, to, apartmentId, propertyDbId]);
    if (key === inflightKey) return;
    inflightKey = key;
    const requestId = ++latestRequestId;
    const isLatest = () => requestId === latestRequestId;

    // isLoading lives in dashState so every hook instance (DateFilterBar,
    // dashboard index, etc.) that calls loadData updates the same flag,
    // letting the single overlay in index.jsx react to all fetches.
    updateDashState({ isLoading: true });
    setBanner({ message: '⏳ Loading data…', type: 'loading' });

    try {
      const res = await fetchDashboard({ from, to, apartmentId, propertyDbId }, auth);
      if (!isLatest()) return;

      if (!res) {
        setBanner({ message: '⚠️ Session expired. Please sign in again.', type: 'error' });
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (!isLatest()) return;
        setBanner({ message: `⚠️ Could not load data: ${err.error || 'unknown error'}`, type: 'error' });
        return;
      }

      const data = await res.json();
      if (!isLatest()) return;

      if (data.smoobuNotConnected) {
        updateDashState({ rawData: data });
        setBanner({ message: data.message || 'Connect your Smoobu account to see live data.', type: 'connect' });
        return;
      }

      updateDashState({ rawData: data });

      if (data.period) {
        updateDashState({ from: data.period.from, to: data.period.to });
      }

      setBanner(data.demo ? { message: 'Demo data', type: 'demo' } : { message: 'Live data', type: 'live' });
    } finally {
      if (isLatest()) {
        inflightKey = null;
        updateDashState({ isLoading: false, isSwitching: false });
      }
    }
  }, [auth, dashState.from, dashState.to, dashState.selectedPropertyId, updateDashState]);

  return { loadData, banner };
}