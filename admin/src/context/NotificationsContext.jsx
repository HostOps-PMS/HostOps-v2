import { createContext, useContext, useState, useCallback } from 'react';

const READ_KEY = 'hostops:admin-read-alerts';

// Alerts are derived server-side with index ids, so key on content instead.
// A changed desc (e.g. new cancellation %) counts as a new, unread alert.
const alertKey = (a) => `${a.title}|${a.desc}|${a.clientId ?? ''}`;

function loadRead() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY)) || []); } catch { return new Set(); }
}

const NotificationsContext = createContext({
  alerts: [],
  activities: [],
  loading: false,
  refetch: () => {},
  setOverviewData: () => {},
  isUnread: () => false,
  markRead: () => {},
});

export function NotificationsProvider({ children }) {
  const [alerts,      setAlerts]      = useState([]);
  const [activities,  setActivities]  = useState([]);
  const [loading]     = useState(false);
  const [readKeys,    setReadKeys]    = useState(loadRead);

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

  const isUnread = useCallback((a) => !!a.unread && !readKeys.has(alertKey(a)), [readKeys]);

  const persist = (next) => {
    try { localStorage.setItem(READ_KEY, JSON.stringify([...next])); } catch { /* storage blocked */ }
    return next;
  };
  const markRead = useCallback((list) => {
    setReadKeys(prev => persist(new Set([...prev, ...[].concat(list).map(alertKey)])));
  }, []);

  return (
    <NotificationsContext.Provider value={{ alerts, activities, loading, refetch: fetchNotifications, setOverviewData, isUnread, markRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
