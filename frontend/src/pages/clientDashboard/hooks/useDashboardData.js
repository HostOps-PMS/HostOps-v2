import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { useDashboard } from '../context/DashboardContext';
import { fetchDashboard } from '../services/dashboardService';

export function useDashboardData() {
  const auth = useAuth();
  const { dashState, updateDashState } = useDashboard();
  const [banner, setBanner] = useState({ message: '', type: '' });
  const loadingRef = useRef(false);

  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    setBanner({ message: '⏳ Loading data…', type: 'loading' });

    try {
      const res = await fetchDashboard({ from: dashState.from, to: dashState.to }, auth);

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