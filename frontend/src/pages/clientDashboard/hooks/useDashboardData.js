import { useCallback, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { useDashboard } from '../context/DashboardContext';
import { fetchDashboard } from '../services/dashboardService';

export function useDashboardData() {


  const auth = useAuth();


  const { dashState, updateDashState } = useDashboard();
  const [banner, setBanner] = useState({ message: '', type: '' });

  const loadData = useCallback(async () => {
    setBanner({ message: '⏳ Loading data…', type: 'loading' });

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
    updateDashState({ rawData: data });

    if (data.period) {
      updateDashState({ from: data.period.from, to: data.period.to });
    }

    setBanner({ message: 'Live data', type: 'live' });
  }, [auth, dashState.from, dashState.to, updateDashState]);

  return { loadData, banner };
}