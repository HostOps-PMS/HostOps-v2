import { createContext, useContext, useState, useCallback } from 'react';

const NotificationsContext = createContext({
  alerts: [],
  activities: [],
  loading: false,
  refetch: () => {},
  setOverviewData: () => {},
});

export function NotificationsProvider({ children }) {
  const [alerts,      setAlerts]      = useState([]);
  const [activities,  setActivities]  = useState([]);
  const [loading]     = useState(false);

  // alerts and activities are populated externally via setOverviewData
  // called by the dashboard's useStats hook after it fetches the overview
  const setOverviewData = useCallback((data) => {
    if (!data) return;
    setAlerts(data.alerts ?? []);
    setActivities(data.recentActivities ?? []);
  }, []);

  // fetchNotifications kept for manual refetch compatibility — alerts/activities
  // come from useStats via setOverviewData, so there is nothing left to refetch here.
  const fetchNotifications = useCallback(() => {}, []);

  return (
    <NotificationsContext.Provider value={{ alerts, activities, loading, refetch: fetchNotifications, setOverviewData }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
