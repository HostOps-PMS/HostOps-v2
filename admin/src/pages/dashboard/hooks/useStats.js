import { useState, useEffect } from 'react';

const MOCK_STATS = [
  { label: 'Total Clients',    value: '128',    change: '15 new',        trend: 'up', color: 'green'  },
  { label: 'Total Properties', value: '542',    change: '43 added',      trend: 'up', color: 'blue'   },
  { label: 'Active Bookings',  value: '1,842',  change: '21% growth',    trend: 'up', color: 'yellow' },
  { label: 'Monthly Revenue',  value: '₱12.4M', change: '8.3% increase', trend: 'up', color: 'red'    },
];

export function useStats() {
  const [stats,   setStats]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
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