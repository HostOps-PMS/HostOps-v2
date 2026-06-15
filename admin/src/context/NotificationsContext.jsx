import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getDashboardOverview } from '../pages/dashboard/services/dashboardService';
import { getToken } from '../lib/authUtils';

const NotificationsContext = createContext({
  alerts: [],
  activities: [],
  loading: false,
  refetch: () => {},
});

export function NotificationsProvider({ children }) {
  const [alerts,     setAlerts]     = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading,    setLoading]    = useState(true);

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

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // refresh every 60s

    // Refetch when the tab regains focus (handles the case where the context
    // mounted before the token was ready, or the initial fetch failed silently).
    function onVisible() {
      if (document.visibilityState === 'visible') fetchNotifications();
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchNotifications]);

  return (
    <NotificationsContext.Provider value={{ alerts, activities, loading, refetch: fetchNotifications }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}