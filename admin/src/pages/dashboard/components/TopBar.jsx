import { useState, useRef, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function timeAgo(timeStr) {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  if (isNaN(date)) return timeStr;
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Derive initials + a stable background color from a name string
function getInitialsAvatar(name) {
  if (!name) return { initials: '?', bg: '#9e9e9e' };
  const parts    = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
  const COLORS = ['#1a9e6e','#2196f3','#9c27b0','#f44336','#ff9800','#00bcd4','#3f51b5','#e91e63'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const bg = COLORS[Math.abs(hash) % COLORS.length];
  return { initials, bg };
}

// SVG icon set — no emojis anywhere
const TypeIcon = ({ type, size = 15 }) => {
  const s = { width: size, height: size, flexShrink: 0 };
  const sw = '1.9'; // strokeWidth — slightly bolder for small sizes
  switch (type) {
    case 'booking':
      return (
        <svg {...s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={sw}>
          <rect x="3" y="4" width="14" height="13" rx="2"/>
          <path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round"/>
        </svg>
      );
    case 'cancellation':
      return (
        <svg {...s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={sw}>
          <circle cx="10" cy="10" r="7"/>
          <path d="M7 7l6 6M13 7l-6 6" strokeLinecap="round"/>
        </svg>
      );
    case 'payment':
      return (
        <svg {...s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={sw}>
          <rect x="2" y="5" width="16" height="11" rx="2"/>
          <path d="M2 9h16" strokeLinecap="round"/>
          <rect x="5" y="12" width="3" height="2" rx="0.5" fill="currentColor" stroke="none"/>
        </svg>
      );
    case 'warning':
      return (
        <svg {...s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M10 3L2 17h16L10 3z" strokeLinejoin="round"/>
          <path d="M10 9v3.5M10 14.2v.5" strokeLinecap="round"/>
        </svg>
      );
    case 'checkin':
      return (
        <svg {...s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M13 10H3M9 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M17 4v12" strokeLinecap="round"/>
        </svg>
      );
    case 'checkout':
      return (
        <svg {...s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M7 10h10M13 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 4v12" strokeLinecap="round"/>
        </svg>
      );
    default:
      return (
        <svg {...s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M10 2a6 6 0 00-6 6v3l-1.5 2H17.5L16 11V8a6 6 0 00-6-6z"/>
          <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round"/>
        </svg>
      );
  }
};

// Light pastel bg + saturated icon color — always enough contrast
const ALERT_TYPE_STYLE = {
  booking:      { bg: '#e6f4ea', color: '#1e7e45' },
  cancellation: { bg: '#fdecea', color: '#c0392b' },
  payment:      { bg: '#e8f0fe', color: '#1a56c4' },
  warning:      { bg: '#fef6e0', color: '#c47c00' },
  info:         { bg: '#f0ebfc', color: '#6d28d9' },
  default:      { bg: '#f0f0f0', color: '#444'    },
};

function getAlertStyle(type) {
  return ALERT_TYPE_STYLE[type] ?? ALERT_TYPE_STYLE.default;
}

// ─────────────────────────────────────────────────────────────────
// InitialsAvatar — always renders initials, never a broken <img>
// ─────────────────────────────────────────────────────────────────
function InitialsAvatar({ name, size = 34, radius = 10, bg }) {
  const derived = getInitialsAvatar(name);
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: radius,
      background: bg || derived.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.floor(size * 0.35),
      fontWeight: 700,
      color: '#fff',
      flexShrink: 0,
      letterSpacing: '0.02em',
      userSelect: 'none',
    }}>
      {derived.initials}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// NotificationDropdown
// ─────────────────────────────────────────────────────────────────
function NotificationDropdown({ alerts = [], activities = [], loading, onClose }) {
  const [activeTab, setActiveTab] = useState('alerts');
  const [readIds,   setReadIds]   = useState(new Set());

  const unreadAlerts = (alerts || []).filter(a => a.unread && !readIds.has(a.id)).length;

  const markAllRead = () => {
    setReadIds(prev => new Set([...prev, ...(alerts || []).map(a => a.id)]));
  };

  const items = activeTab === 'alerts' ? (alerts || []) : (activities || []);

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 10px)',
        right: 0,
        width: 360,
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.13), 0 1.5px 6px rgba(0,0,0,0.07)',
        border: '0.5px solid rgba(0,0,0,0.08)',
        zIndex: 9999,
        overflow: 'hidden',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        animation: 'notif-drop 0.18s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <style>{`
        @keyframes notif-drop {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .notif-item:hover { background: #f8f9fa !important; }
        .notif-tab-btn:hover { background: rgba(0,0,0,0.04) !important; }
        .notif-mark-all:hover { color: #1a9e6e !important; }
        .notif-scrollable::-webkit-scrollbar { width: 4px; }
        .notif-scrollable::-webkit-scrollbar-track { background: transparent; }
        .notif-scrollable::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div style={{ padding: '14px 16px 0', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Notifications</span>
            {unreadAlerts > 0 && (
              <span style={{
                background: '#1a9e6e', color: '#fff',
                fontSize: 10, fontWeight: 700,
                borderRadius: 20, padding: '1px 7px', lineHeight: '16px',
              }}>
                {unreadAlerts}
              </span>
            )}
          </div>
          <button
            className="notif-mark-all"
            onClick={markAllRead}
            style={{ fontSize: 11, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.15s' }}
          >
            Mark all read
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { key: 'alerts',     label: 'Alerts',   count: (alerts     || []).length },
            { key: 'activities', label: 'Activity', count: (activities || []).length },
          ].map(tab => (
            <button
              key={tab.key}
              className="notif-tab-btn"
              onClick={() => setActiveTab(tab.key)}
              style={{
                fontSize: 12,
                fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? '#1a9e6e' : '#888',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #1a9e6e' : '2px solid transparent',
                padding: '4px 10px 8px',
                cursor: 'pointer',
                borderRadius: '4px 4px 0 0',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{ fontSize: 10, color: activeTab === tab.key ? '#1a9e6e' : '#aaa', fontWeight: 500 }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="notif-scrollable" style={{ maxHeight: 360, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '28px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#bbb' }}>Loading...</div>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '36px 0', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: '#ccc' }}>
              <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 2a6 6 0 00-6 6v3l-1.5 2H17.5L16 11V8a6 6 0 00-6-6z"/>
                <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 12, color: '#aaa' }}>
              {activeTab === 'alerts' ? 'No alerts right now' : 'No recent activity'}
            </div>
          </div>
        ) : activeTab === 'alerts' ? (
          (alerts || []).map((alert, i) => {
            const typeStyle = getAlertStyle(alert.type);
            const isRead    = readIds.has(alert.id) || !alert.unread;
            // Prefer clientName for the avatar name; fall back to title
            const avatarName = alert.clientName || alert.title || '';
            return (
              <div
                key={alert.id ?? i}
                className="notif-item"
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '11px 16px',
                  borderBottom: '0.5px solid rgba(0,0,0,0.05)',
                  cursor: 'default',
                  background: isRead ? '#fff' : '#f0faf6',
                  transition: 'background 0.12s',
                }}
              >
                {/* Type icon — always use our controlled bg+color, never backend avatarBg */}
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: typeStyle.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: typeStyle.color,
                }}>
                  <TypeIcon type={alert.type} size={17} />
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: isRead ? 500 : 600, color: '#111',
                    lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {alert.title}
                  </div>
                  {alert.desc && (
                    <div style={{
                      fontSize: 11, color: '#888', marginTop: 1, lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {alert.desc}
                    </div>
                  )}
                  {alert.clientName && (
                    <div style={{ fontSize: 10, color: '#1a9e6e', marginTop: 3, fontWeight: 500 }}>
                      {alert.clientName}
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#bbb', whiteSpace: 'nowrap' }}>
                    {timeAgo(alert.time)}
                  </div>
                  {!isRead && (
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: '#1a9e6e', marginLeft: 'auto', marginTop: 5,
                    }} />
                  )}
                </div>
              </div>
            );
          })
        ) : (
          (activities || []).map((act, i) => {
            // Build a display name from actor for the initials avatar
            const avatarName = act.actor || '';
            return (
              <div
                key={act.id ?? i}
                className="notif-item"
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '11px 16px',
                  borderBottom: '0.5px solid rgba(0,0,0,0.05)',
                  cursor: 'default',
                  background: '#fff',
                  transition: 'background 0.12s',
                }}
              >
                {/* InitialsAvatar from actor name — no broken images */}
                <InitialsAvatar name={avatarName} size={34} radius={10} />

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#111', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 600 }}>{act.actor}</span>
                    {' '}
                    <span style={{ color: '#555' }}>{act.action}</span>
                    {act.target && (
                      <span style={{ color: '#1a9e6e', fontWeight: 600 }}> {act.target}</span>
                    )}
                  </div>
                  {act.time && (
                    <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>
                      {timeAgo(act.time)}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '0.5px solid rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{ fontSize: 11, color: '#1a9e6e', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
          >
            View all in dashboard
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TopBar
// ─────────────────────────────────────────────────────────────────
export default function TopBar({ onAction, onExport, exportLoading = false, alerts = [], activities = [], notifLoading = false }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const currentUser = (() => {
    try { return JSON.parse(sessionStorage.getItem('hp_user') || '{}'); } catch { return {}; }
  })();

  const fullName  = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || 'User';
  const initials  = [currentUser.firstName, currentUser.lastName]
    .filter(Boolean).map(n => n[0].toUpperCase()).join('') || 'U';
  const firstName = currentUser.firstName || 'there';

  const unreadCount = (alerts || []).filter(a => a.unread).length;

  // Close dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    function handleOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [notifOpen]);

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '10px 24px',
      background: '#fff',
      borderBottom: '0.5px solid rgba(0,0,0,0.08)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      position: 'sticky',
      top: 0,
      zIndex: 100,
      minHeight: 60,
    }}>

      {/* Left — Welcome */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111', letterSpacing: '-0.01em' }}>
          Welcome back, {firstName}!
        </div>
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>
          Get a clear view of your real estate portfolio.
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right — Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>

        {/* Export PDF button */}
        <button
          onClick={onExport}
          disabled={exportLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px',
            background: exportLoading ? '#e0e0e0' : '#1a9e6e',
            color: exportLoading ? '#aaa' : '#fff',
            border: 'none', borderRadius: 10,
            cursor: exportLoading ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 600,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            letterSpacing: '0.01em', whiteSpace: 'nowrap',
            transition: 'background 0.15s, color 0.15s',
          }}
          title="Export dashboard as PDF"
        >
          {exportLoading ? (
            /* Spinner */
            <svg
              width="13" height="13" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.2"
              style={{ animation: 'pdf-spin 0.8s linear infinite' }}
            >
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
          ) : (
            /* Download icon */
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 16h14" strokeLinecap="round" />
            </svg>
          )}
          {exportLoading ? 'Exporting...' : 'Export PDF'}
        </button>
        <style>{`@keyframes pdf-spin { to { transform: rotate(360deg); } }`}</style>

        {/* Notification bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setNotifOpen(prev => !prev)}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: notifOpen ? '#e8f5e9' : '#f7f7f7',
              border: notifOpen ? '0.5px solid #a5d6a7' : '0.5px solid rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: notifOpen ? '#1a9e6e' : '#888',
              position: 'relative',
              transition: 'background 0.15s, border 0.15s, color 0.15s',
            }}
            title="Notifications"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 2a6 6 0 00-6 6v3l-1.5 2H17.5L16 11V8a6 6 0 00-6-6z" />
              <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round" />
            </svg>

            {/* Unread badge */}
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 5, right: 5,
                width: 8, height: 8, borderRadius: '50%',
                background: '#e53935', border: '1.5px solid #fff',
              }} />
            )}
          </button>

          {notifOpen && (
            <NotificationDropdown
              alerts={alerts}
              activities={activities}
              loading={notifLoading}
              onClose={() => setNotifOpen(false)}
            />
          )}
        </div>

        {/* Avatar */}
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: '#1a9e6e',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff',
          cursor: 'pointer', flexShrink: 0,
        }} title={fullName}>
          {initials}
        </div>

      </div>
    </header>
  );
}