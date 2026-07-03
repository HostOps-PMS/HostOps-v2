import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getToken, fetchWithAuth } from '../lib/authUtils';

const API_BASE = (import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

const NotificationsContext = createContext({
  alerts: [],
  activities: [],
  bugReports: [],
  loading: false,
  refetch: () => {},
  setOverviewData: () => {},
});

export function NotificationsProvider({ children }) {
  const [alerts,      setAlerts]      = useState([]);
  const [activities,  setActivities]  = useState([]);
  const [bugReports,  setBugReports]  = useState([]);
  const [loading,     setLoading]     = useState(false);

  // alerts and activities are populated externally via setOverviewData
  // called by the dashboard's useStats hook after it fetches the overview
  const setOverviewData = useCallback((data) => {
    if (!data) return;
    setAlerts(data.alerts ?? []);
    setActivities(data.recentActivities ?? []);
  }, []);

  const bugFetchedRef = useRef(false);

  const fetchBugReports = useCallback(async () => {
    const token = getToken();
    if (!token || bugFetchedRef.current) return;
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

  // fetchNotifications kept for manual refetch compatibility but no longer
  // calls getDashboardOverview — the dashboard overview is fetched once by
  // useStats and shared here via setOverviewData to avoid duplicate calls.
  const fetchNotifications = useCallback(() => {
    bugFetchedRef.current = false;
    fetchBugReports();
  }, [fetchBugReports]);

  useEffect(() => {
    fetchBugReports();
  }, [fetchBugReports]);

  return (
    <NotificationsContext.Provider value={{ alerts, activities, bugReports, loading, refetch: fetchNotifications, refetchBugReports: fetchBugReports, setOverviewData }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}