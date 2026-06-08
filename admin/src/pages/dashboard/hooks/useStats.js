// hooks/useStats.js
// ─────────────────────────────────────────────────────────────────
// Fetches the admin dashboard overview from GET /api/dashboard-overview
// and shapes the response into the stat-card format expected by StatsRow.
//
// TOTAL CLIENTS and TOTAL PROPERTIES come from the User collection
// (returned by the backend as totalClients / totalProperties).
//
// MONTHLY REVENUE, ACTIVE BOOKINGS are aggregated from all Smoobu
// API keys across all client properties.
// ─────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';

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
  const [stats,       setStats]       = useState([]);
  const [overview,    setOverview]    = useState(null); // full payload for other hooks
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = sessionStorage.getItem('hp_access_token') ?? '';
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to)   params.set('to', to);

      const url = `/api/dashboard-overview${params.toString() ? '?' + params.toString() : ''}`;

      const res = await fetch(url, {
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${token}`,
          'x-api-key':     import.meta.env.VITE_API_KEY ?? '',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`API ${res.status}: ${msg}`);
      }

      const data = await res.json();

      // Debug: log what the overview payload contains so we can verify
      // mapLocations is being returned by the backend.
      console.log('[useStats] overview keys:', Object.keys(data));
      console.log('[useStats] mapLocations count:', Array.isArray(data.mapLocations) ? data.mapLocations.length : 'MISSING');
      console.log('[useStats] _version:', data._version ?? 'n/a');

      setOverview(data);
      setStats(buildStatsCards(data));
    } catch (err) {
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