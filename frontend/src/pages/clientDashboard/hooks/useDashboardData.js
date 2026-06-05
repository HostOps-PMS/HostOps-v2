import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { useDashboard } from '../context/DashboardContext';
import { fetchDashboard } from '../services/dashboardService';

export function useDashboardData() {
  const auth = useAuth();
  const { dashState, updateDashState } = useDashboard();
  const [banner, setBanner] = useState({ message: '', type: '' });
  const loadingRef = useRef(false);

  // fromOverride / toOverride: pass explicit dates when calling right after
  // updateDashState() so we don't read a stale closure value.
  //
  // apartmentIdOverride: pass an explicit apartmentId right after selectProperty()
  // so we don't read a stale closure. Omit to use dashState.selectedPropertyId.
  //
  // propertyDbId: MongoDB _id of the selected property (from hp_selected_property_id
  // in localStorage). Passed to the backend so it can look up the correct
  // smoobuApiKey from user.properties[] for that specific property.
  const loadData = useCallback(async (fromOverride, toOverride, apartmentIdOverride) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    const from = fromOverride ?? dashState.from;
    const to   = toOverride   ?? dashState.to;

    // FIX: Read from localStorage instead of sessionStorage.
    // sessionStorage is cleared when the login app redirects to the dashboard
    // app across origins — localStorage persists correctly.
    // selectProperty() writes hp_selected_property_id synchronously to
    // localStorage before the useEffect in index.jsx fires loadData(),
    // so this is always current.
    const propertyDbId = localStorage.getItem('hp_selected_property_id') || null;

    // apartmentId is the Smoobu numeric ID for frontend-side filtering.
    // When propertyDbId is set, the backend already scopes the API call to
    // that property's smoobuApiKey — no extra apartmentId filter needed.
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

      // smoobuNotConnected: true means the user has no Smoobu API key configured
      // yet. This is a normal state for new users — not an error.
      // The banner switches to 'connect' type so index.jsx can show a prompt
      // instead of an empty dashboard with no explanation.
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
    }
  }, [auth, dashState.from, dashState.to, dashState.selectedPropertyId, updateDashState]);

  return { loadData, banner };
}