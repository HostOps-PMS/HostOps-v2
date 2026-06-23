import { useState, useEffect, useCallback } from 'react';
import { getAnnouncements } from '../services/announcementsService';

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAnnouncements();
      const normalized = Array.isArray(data) ? data : (data?.announcements ?? data?.data ?? []);
      setAnnouncements(normalized);
    } catch (err) {
      setError(err.message ?? 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { announcements, loading, error, refetch: fetch };
}
