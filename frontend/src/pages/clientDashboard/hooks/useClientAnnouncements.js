import { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';
import { fetchClientAnnouncements } from '../services/announcementsService';

export function useClientAnnouncements() {
  const auth = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[useClientAnnouncements] isReady:', auth.isReady);
    // Wait for auth hydration (silent refresh on mount) before fetching
    if (!auth.isReady) return;

    let cancelled = false;
    setLoading(true);
    fetchClientAnnouncements(auth)
      .then(data => { if (!cancelled) setAnnouncements(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [auth.isReady]);

  return { announcements, loading };
}
