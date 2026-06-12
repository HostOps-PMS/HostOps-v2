import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getDashboardOverview } from '../pages/dashboard/services/dashboardService';

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
    const token = sessionStorage.getItem('hp_access_token');
    if (!token) {
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
    return () => clearInterval(interval);
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