import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getSecureUser } from '../../../lib/secureUserStorage';
import { useNotifications } from '../../../context/NotificationsContext';
import { useTheme } from '../../../context/ThemeContext';
import { fetchWithAuth } from '../../../lib/authUtils';
import AccountSettingsModal from './AccountSettingsModal';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function timeAgo(timeStr) {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  if (isNaN(date.getTime())) return '';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 0)     return 'just now';
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

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

const TypeIcon = ({ type, size = 15 }) => {
  const s = { width: size, height: size, flexShrink: 0 };
  const sw = '1.9';
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

const ALERT_TYPE_STYLE = {
  booking:      { bg: '#e6f4ea', color: '#1e7e45' },
  cancellation: { bg: '#fdecea', color: '#c0392b' },
  payment:      { bg: '#e8f0fe', color: '#1a56c4' },
  warning:      { bg: '#fef6e0', color: '#c47c00' },
  info:         { bg: '#f0ebfc', color: '#6d28d9' },
  default:      { bg: '#f0f0f0', color: '#444'    },
};

const ALERT_TYPE_STYLE_DARK = {
  booking:      { bg: '#0d2a18', color: '#4ade80' },
  cancellation: { bg: '#2a0d0d', color: '#f87171' },
  payment:      { bg: '#0d1a2a', color: '#60a5fa' },
  warning:      { bg: '#2a1f00', color: '#fbbf24' },
  info:         { bg: '#1a0d2a', color: '#a78bfa' },
  default:      { bg: '#132a1e', color: '#7ab89a' },
};

function getAlertStyle(type, dark) {
  const map = dark ? ALERT_TYPE_STYLE_DARK : ALERT_TYPE_STYLE;
  return map[type] ?? map.default;
}

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
// Moon / Sun SVG icons
// ─────────────────────────────────────────────────────────────────
const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M17 12A7 7 0 119 4a5 5 0 008 8z" strokeLinejoin="round"/>
  </svg>
);

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="10" cy="10" r="4"/>
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" strokeLinecap="round"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────
// NotificationDropdown
// ─────────────────────────────────────────────────────────────────
function NotificationDropdown({ alerts = [], activities = [], loading, onClose }) {
  const [activeTab, setActiveTab] = useState('alerts');
  const [readIds,   setReadIds]   = useState(new Set());
  const { bugReports: ctxBugReports } = useNotifications();
  const bugReports = ctxBugReports || [];
  const { dark } = useTheme();
  const navigate = useNavigate();

  const openReports = bugReports.filter(r => r.status === 'open').length;
  const unreadAlerts = (alerts || []).filter(a => a.unread && !readIds.has(a.id)).length;

  const markAllRead = () => {
    setReadIds(prev => new Set([...prev, ...(alerts || []).map(a => a.id)]));
  };

  const items = activeTab === 'alerts' ? (alerts || []) : activeTab === 'activities' ? (activities || []) : bugReports;

  const surface   = dark ? '#132a1e' : '#fff';
  const border    = dark ? '#1e3a2a' : 'rgba(0,0,0,0.08)';
  const textMain  = dark ? '#eaf5f0' : '#111';
  const textMuted = dark ? '#7ab89a' : '#888';
  const textDim   = dark ? '#4d8a6a' : '#bbb';
  const itemBorderB = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
  const unreadBg  = dark ? '#0d2619' : '#f0faf6';
  const readBg    = dark ? '#132a1e' : '#fff';
  const hoverBg   = dark ? '#0d2619' : '#f8f9fa';
  const scrollThumb = dark ? '#1e3a2a' : '#e0e0e0';

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: 60,
        right: 8,
        left: 8,
        maxWidth: 360,
        marginLeft: 'auto',
        width: 'auto',
        background: surface,
        borderRadius: 14,
        boxShadow: dark
          ? '0 8px 32px rgba(0,0,0,0.5), 0 1.5px 6px rgba(0,0,0,0.3)'
          : '0 8px 32px rgba(0,0,0,0.13), 0 1.5px 6px rgba(0,0,0,0.07)',
        border: `0.5px solid ${border}`,
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
        .notif-item:hover { background: ${hoverBg} !important; }
        .notif-tab-btn:hover { background: rgba(${dark ? '255,255,255' : '0,0,0'},0.04) !important; }
        .notif-tabs-scroll::-webkit-scrollbar { display: none; }
        .notif-mark-all:hover { color: #26c47a !important; }
        .notif-scrollable::-webkit-scrollbar { width: 4px; }
        .notif-scrollable::-webkit-scrollbar-track { background: transparent; }
        .notif-scrollable::-webkit-scrollbar-thumb { background: ${scrollThumb}; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div style={{ padding: '14px 16px 0', borderBottom: `0.5px solid ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: textMain }}>Notifications</span>
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
            style={{ fontSize: 11, color: textDim, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.15s' }}
          >
            Mark all read
          </button>
        </div>

        {/* Tabs */}
        <div className="notif-tabs-scroll" style={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none' }}>
          {[
            { key: 'alerts',     label: 'Alerts',   count: (alerts     || []).length },
            { key: 'activities', label: 'Activity', count: (activities || []).length },
            { key: 'reports',    label: 'Reports',  count: bugReports.length, highlight: bugReports.some(r => r.status === 'open') },
          ].map(tab => (
            <button
              key={tab.key}
              className="notif-tab-btn"
              onClick={() => setActiveTab(tab.key)}
              style={{
                fontSize: 12,
                fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? '#1a9e6e' : textMuted,
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #1a9e6e' : '2px solid transparent',
                padding: '4px 8px 8px',
                cursor: 'pointer',
                borderRadius: '4px 4px 0 0',
                whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{ fontSize: 10, color: activeTab === tab.key ? '#1a9e6e' : textDim, fontWeight: 500 }}>
                  {tab.count}
                </span>
              )}
              {tab.highlight && activeTab !== tab.key && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="notif-scrollable" style={{ maxHeight: 360, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '28px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: textDim }}>Loading...</div>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '36px 0', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: dark ? '#1e3a2a' : '#ccc' }}>
              <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 2a6 6 0 00-6 6v3l-1.5 2H17.5L16 11V8a6 6 0 00-6-6z"/>
                <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 12, color: textMuted }}>
              {activeTab === 'alerts' ? 'No alerts right now' : activeTab === 'activities' ? 'No recent activity' : 'No bug reports yet'}
            </div>
          </div>
        ) : activeTab === 'alerts' ? (
          (alerts || []).map((alert, i) => {
            const typeStyle = getAlertStyle(alert.type, dark);
            const isRead    = readIds.has(alert.id) || !alert.unread;
            return (
              <div
                key={alert.id ?? i}
                className="notif-item"
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '11px 16px',
                  borderBottom: `0.5px solid ${itemBorderB}`,
                  cursor: 'default',
                  background: isRead ? readBg : unreadBg,
                  transition: 'background 0.12s',
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: typeStyle.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: typeStyle.color,
                }}>
                  <TypeIcon type={alert.type} size={17} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: isRead ? 500 : 600, color: textMain,
                    lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {alert.title}
                  </div>
                  {alert.desc && (
                    <div style={{
                      fontSize: 11, color: textMuted, marginTop: 1, lineHeight: 1.4,
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

                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: textDim, whiteSpace: 'nowrap' }}>
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
        ) : activeTab === 'activities' ? (
          (activities || []).map((act, i) => (
            <div
              key={act.id ?? i}
              className="notif-item"
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '11px 16px',
                borderBottom: `0.5px solid ${itemBorderB}`,
                cursor: 'default',
                background: readBg,
                transition: 'background 0.12s',
              }}
            >
              <InitialsAvatar name={act.actor || ''} size={34} radius={10} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: textMain, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600 }}>{act.actor}</span>
                  {' '}
                  <span style={{ color: textMuted }}>{act.action}</span>
                  {act.target && (
                    <span style={{ color: '#1a9e6e', fontWeight: 600 }}> {act.target}</span>
                  )}
                </div>
                {(act.time || act.createdAt || act.timestamp) && (
                  <div style={{ fontSize: 10, color: textDim, marginTop: 2 }}>
                    {timeAgo(act.time || act.createdAt || act.timestamp)}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          bugReports.map((r, i) => {
            const sevMeta = { low: { label: 'Low', bg: dark ? '#052e16' : '#f0fdf4', color: dark ? '#4ade80' : '#16a34a', border: dark ? '#166534' : '#bbf7d0' }, medium: { label: 'Medium', bg: dark ? '#2a1f0a' : '#fffbeb', color: dark ? '#fbbf24' : '#d97706', border: dark ? '#5c3a0a' : '#fde68a' }, high: { label: 'High', bg: dark ? '#2a1a0a' : '#fff7ed', color: dark ? '#fb923c' : '#ea580c', border: dark ? '#5c2a0a' : '#fed7aa' }, critical: { label: 'Critical', bg: dark ? '#2a0d0d' : '#fef2f2', color: dark ? '#f87171' : '#dc2626', border: dark ? '#5c1a1a' : '#fecaca' } };
            const stMeta = { open: { label: 'Open', bg: dark ? '#2a1a0a' : '#fff7ed', color: dark ? '#fb923c' : '#ea580c', border: dark ? '#5c2a0a' : '#fed7aa' }, in_progress: { label: 'In Progress', bg: dark ? '#2a1f0a' : '#fffbeb', color: dark ? '#fbbf24' : '#d97706', border: dark ? '#5c3a0a' : '#fde68a' }, sent: { label: 'Sent', bg: dark ? '#0d1a2a' : '#eff6ff', color: dark ? '#60a5fa' : '#2563eb', border: dark ? '#1a3a5c' : '#bfdbfe' }, resolved: { label: 'Resolved', bg: dark ? '#052e16' : '#f0fdf4', color: dark ? '#4ade80' : '#16a34a', border: dark ? '#166534' : '#bbf7d0' }, dismissed: { label: 'Dismissed', bg: dark ? '#1f2937' : '#f3f4f6', color: dark ? '#9ca3af' : '#6b7280', border: dark ? '#374151' : '#e5e7eb' } };
            const sev = sevMeta[r.severity] || sevMeta.high;
            const st = stMeta[r.status] || stMeta.open;
            const reporterName = (r.name && r.name !== r.email && !r.name.includes('@')) ? r.name : (r.email ? r.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '?');
            const reporterInitial = (reporterName[0] || '?').toUpperCase();
            return (
              <div
                key={r._id ?? i}
                className="notif-item"
                onClick={() => { onClose(); navigate('/bug-reports'); }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '11px 16px',
                  borderBottom: `0.5px solid ${itemBorderB}`,
                  cursor: 'pointer',
                  background: r.status === 'open' ? unreadBg : readBg,
                  transition: 'background 0.12s',
                }}
              >
                <InitialsAvatar name={reporterName} size={34} radius={10} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, color: sev.color, background: sev.bg, border: `1px solid ${sev.border}`, letterSpacing: 0.3 }}>
                      {sev.label}
                    </span>
                    <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, color: st.color, background: st.bg, border: `1px solid ${st.border}`, letterSpacing: 0.3 }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: textMain, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.page || 'General'}
                  </div>
                  <div style={{ fontSize: 11, color: textMuted, marginTop: 1 }}>
                    {reporterName}
                  </div>
                </div>

                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: textDim, whiteSpace: 'nowrap' }}>{timeAgo(r.createdAt)}</div>
                  {r.status === 'open' && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f97316', marginLeft: 'auto', marginTop: 5 }} />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: `0.5px solid ${border}`, textAlign: 'center' }}>
          <button
            onClick={() => {
              onClose();
              navigate(activeTab === 'alerts' ? '/alerts' : activeTab === 'activities' ? '/recent-activities' : '/bug-reports');
            }}
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
export default function TopBar({ onAction, onExport, exportLoading = false, alerts, activities, notifLoading, showExport = false }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const notifRef = useRef(null);
  const { dark, toggleDark } = useTheme();

  const notifContext       = useNotifications();
  const resolvedAlerts     = alerts     ?? notifContext.alerts;
  const resolvedActivities = activities ?? notifContext.activities;
  const resolvedLoading    = notifLoading ?? notifContext.loading;

const [currentUser, setCurrentUser] = useState(() => {
    try { return getSecureUser() || {}; } catch { return {}; }
  });

  useEffect(() => {
    function handleUserUpdated(e) {
      setCurrentUser(e.detail);
    }
    window.addEventListener('hostops:user-updated', handleUserUpdated);
    return () => window.removeEventListener('hostops:user-updated', handleUserUpdated);
  }, []);

  const fullName  = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || 'User';
  const initials  = [currentUser.firstName, currentUser.lastName]
    .filter(Boolean).map(n => n[0].toUpperCase()).join('') || 'U';

  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/dashboard/';
  const unreadCount = (resolvedAlerts || []).filter(a => a.unread).length;

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
    <>
    <style>{`@media (max-width: 768px) { .db-topbar-header { display: none !important; } }`}</style>
    <header className="db-topbar-header" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 16px',
      background: dark ? '#132a1e' : '#fff',
      borderBottom: `0.5px solid ${dark ? '#1e3a2a' : 'rgba(0,0,0,0.08)'}`,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      position: 'sticky',
      top: 0,
      zIndex: 100,
      minHeight: 60,
      flexWrap: 'wrap',
      transition: 'background 0.2s, border-color 0.2s',
    }}>

      {/* Left — Title */}
      <div style={{ flex: 1, minWidth: 120 }}>
        <div style={{
          fontSize: 16, fontWeight: 700,
          color: dark ? '#eaf5f0' : '#111',
          letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          Admin Dashboard
        </div>
      </div>

      {/* Right — Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>

        {/* Export PDF button */}
        {isDashboard && onExport && (
          <>
            <button
              onClick={onExport}
              disabled={exportLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px',
                background: exportLoading ? (dark ? '#0d2619' : '#e0e0e0') : '#1a9e6e',
                color: exportLoading ? (dark ? '#4d8a6a' : '#aaa') : '#fff',
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
                <svg
                  width="13" height="13" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.2"
                  style={{ animation: 'pdf-spin 0.8s linear infinite' }}
                >
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 16h14" strokeLinecap="round" />
                </svg>
              )}
              {exportLoading ? 'Exporting...' : 'Export PDF'}
            </button>
            <style>{`@keyframes pdf-spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: dark ? '#0d2619' : '#f7f7f7',
            border: `0.5px solid ${dark ? '#1e3a2a' : 'rgba(0,0,0,0.08)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: dark ? '#7ab89a' : '#888',
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          }}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Notification bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setNotifOpen(prev => !prev)}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: notifOpen
                ? (dark ? '#0d2619' : '#e8f5e9')
                : (dark ? '#0d2619' : '#f7f7f7'),
              border: notifOpen
                ? `0.5px solid ${dark ? '#1e3a2a' : '#a5d6a7'}`
                : `0.5px solid ${dark ? '#1e3a2a' : 'rgba(0,0,0,0.08)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: notifOpen ? '#1a9e6e' : (dark ? '#7ab89a' : '#888'),
              position: 'relative',
              transition: 'background 0.15s, border 0.15s, color 0.15s',
            }}
            title="Notifications"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 2a6 6 0 00-6 6v3l-1.5 2H17.5L16 11V8a6 6 0 00-6-6z" />
              <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round" />
            </svg>

            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 5, right: 5,
                width: 8, height: 8, borderRadius: '50%',
                background: '#e53935', border: `1.5px solid ${dark ? '#132a1e' : '#fff'}`,
              }} />
            )}
          </button>

          {notifOpen && (
            <NotificationDropdown
              alerts={resolvedAlerts}
              activities={resolvedActivities}
              loading={resolvedLoading}
              onClose={() => setNotifOpen(false)}
            />
          )}
        </div>

        {/* Avatar — display only, no click */}
        {currentUser.profileImage ? (
          <img src={currentUser.profileImage} alt={fullName} title={fullName} style={{
            width: 34, height: 34, borderRadius: '50%', objectFit: 'cover',
            flexShrink: 0, border: `2px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`,
          }} />
        ) : (
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: '#1a9e6e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff',
            flexShrink: 0,
          }} title={fullName}>
            {initials}
          </div>
        )}

      </div>
    </header>

    <AccountSettingsModal
      isOpen={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      onSaved={(updated) => setCurrentUser(updated)}
    />
    </>
  );
}
