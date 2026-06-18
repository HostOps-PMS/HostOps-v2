// src/pages/ActivityLogs/hooks/useActivityLogs.js
import { useState, useEffect } from 'react';
import { fetchAllActivityLogs, fetchClients } from '../services/activityLogApi';

export function useActivityLogs({
  page,
  limit,
  userId,
  action,
  from,
  to,
  _poll = 0,
}) {
  const [logs, setLogs]             = useState([]);
  const [clients, setClients]       = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  // Fetch clients once on mount for filter dropdown
  useEffect(() => {
    fetchClients()
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  // Fetch logs whenever any primitive filter value changes.
  // All deps are primitives (string / number) — no object references —
  // so this effect only fires when something actually changed.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchAllActivityLogs({ page, limit, userId, action, from, to });
        if (cancelled) return;
        setLogs(data.activityLog || []);
        setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 1 });
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // Cleanup: if the component re-renders before the fetch resolves,
    // ignore the stale response to avoid flickering / race conditions.
    return () => { cancelled = true; };
  }, [page, limit, userId, action, from, to, _poll]); // all primitives — stable references

  return { logs, clients, pagination, loading, error };
}