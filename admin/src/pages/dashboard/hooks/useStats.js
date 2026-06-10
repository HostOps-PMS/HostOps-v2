// hooks/useStats.js
// ─────────────────────────────────────────────────────────────────
// Fetches the admin dashboard overview from GET /api/dashboard-overview
// and shapes the response into the stat-card format expected by StatsRow.
//
// IMPORTANT: Uses getDashboardOverview() from dashboardService so that
// all auth headers, base-URL, and credentials config stay in ONE place.
// This fixes the "no data in production" bug where useStats was doing
// its own inline fetch() with a hard-coded relative URL — which worked
// on localhost (same origin, no CORS) but silently failed on deployed
// environments where VITE_API_BASE_URL is required.
// ─────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { getDashboardOverview } from '../services/dashboardService';

function formatRevenue(value) {
  if (value >= 1_000_000) return '₱' + (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000)     return '₱' + (value / 1_000).toFixed(0) + 'K';
  return '₱' + value.toLocaleString();
}

function buildStatsCards(data) {
  return [
    {
      label:  'Total Clients',
      value:  (data.totalClients ?? 0).toLocaleString(),
      change: `${data.connectedProperties ?? 0} connected properties`,
      trend:  'up',
      color:  'green',
    },
    {
      label:  'Total Properties',
      value:  (data.totalProperties ?? 0).toLocaleString(),
      change: `${data.connectedProperties ?? 0} Smoobu linked`,
      trend:  'up',
      color:  'blue',
    },
    {
      label:  'Monthly Revenue',
      value:  formatRevenue(data.monthlyRevenue ?? 0),
      change: `${data.overallOccupancy ?? 0}% avg occupancy`,
      trend:  data.monthlyRevenue > 0 ? 'up' : 'neutral',
      color:  'red',
    },
  ];
}

export function useStats({ from, to } = {}) {
  const [stats,    setStats]    = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // ── Use the shared service so auth headers + base URL are consistent ──
      // getDashboardOverview() reads VITE_API_BASE_URL and hp_access_token from
      // the same place every other service call does — no more "works on
      // localhost but not in prod" from a stale inline fetch().
      const data = await getDashboardOverview({ from, to });

      setOverview(data);
      setStats(buildStatsCards(data));
    } catch (err) {
      console.error('[useStats] fetch failed:', err);
      setError(err.message || 'Failed to fetch dashboard stats');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, overview, loading, error, refetch: fetchStats };
}