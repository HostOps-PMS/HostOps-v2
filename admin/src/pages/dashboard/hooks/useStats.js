import { useState, useEffect } from 'react';

const MOCK_STATS = [
  { label: 'Total Revenue', value: '₱84,230', change: '12.4%', trend: 'up',   color: 'green',  icon: '💰' },
  { label: 'New Orders',    value: '1,284',   change: '8.1%',  trend: 'up',   color: 'blue',   icon: '📦' },
  { label: 'Customers',     value: '5,642',   change: '3.7%',  trend: 'up',   color: 'yellow', icon: '👥' },
  { label: 'Cancelled',     value: '48',       change: '2.5%',  trend: 'down', color: 'red',    icon: '🚫' },
];

/**
 * useStats — fetches dashboard KPI stats.
 * Replace the mock timeout with a real API call via dashboardService.
 */
export function useStats() {
  const [stats,   setStats]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // TODO: replace with → const data = await dashboardService.getStats();
        await new Promise((r) => setTimeout(r, 900));
        if (!cancelled) setStats(MOCK_STATS);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { stats, loading, error };
}
