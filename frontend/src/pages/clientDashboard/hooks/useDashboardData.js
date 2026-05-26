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
  const loadData = useCallback(async (fromOverride, toOverride) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    const from = fromOverride ?? dashState.from;
    const to   = toOverride   ?? dashState.to;

    setBanner({ message: '⏳ Loading data…', type: 'loading' });

    try {
      const res = await fetchDashboard({ from, to }, auth);

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
  }, [auth, dashState.from, dashState.to, updateDashState]);

  return { loadData, banner };
}