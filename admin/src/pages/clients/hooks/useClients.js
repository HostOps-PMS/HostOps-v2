import { useState, useEffect, useCallback } from 'react';
import { getClients } from '../services/clientsService';

/**
 * useClients — fetches all registered clients from the backend.
 * Exposes `refetch` so the page can manually refresh the list.
 */
export function useClients() {
  const [clients, setClients]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClients();
      setClients(data);
    } catch (err) {
      setError(err.message ?? 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { clients, loading, error, refetch: fetch };
}