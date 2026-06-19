import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getDashboardOverview } from '../pages/dashboard/services/dashboardService';
import { getToken, fetchWithAuth } from '../lib/authUtils';

const API_BASE = (import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

const NotificationsContext = createContext({
  alerts: [],
  activities: [],
  bugReports: [],
  loading: false,
  refetch: () => {},
});

export function NotificationsProvider({ children }) {
  const [alerts,      setAlerts]      = useState([]);
  const [activities,  setActivities]  = useState([]);
  const [bugReports,  setBugReports]  = useState([]);
  const [loading,     setLoading]     = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getDashboardOverview({});
      setAlerts(data?.alerts ?? []);
      setActivities(data?.recentActivities ?? []);
    } catch (err) {
      console.error('[NotificationsContext] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const bugFetchedRef = useRef(false);

  const fetchBugReports = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/bug-reports`);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setBugReports(data);
          bugFetchedRef.current = true;
        }
      }
    } catch (err) {
      console.warn('[NotificationsContext] bug reports fetch failed:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchBugReports();

    const interval = setInterval(() => {
      fetchNotifications();
      fetchBugReports();
    }, 60000);

    function onVisible() {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
        fetchBugReports();
      }
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchNotifications, fetchBugReports]);

  return (
    <NotificationsContext.Provider value={{ alerts, activities, bugReports, loading, refetch: fetchNotifications, refetchBugReports: fetchBugReports }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}