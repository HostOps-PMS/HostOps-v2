import { useState, useMemo, useRef, useEffect } from 'react';
import Sidebar from '../Sidebar';
import TopBar from '../dashboard/components/TopBar';
import { useTheme } from '../../context/ThemeContext';
import { fetchAllActivityLogs } from '../ActivityLogs/services/activityLogApi';
import { useIpLocations, formatLocation } from '../../hooks/useIpLocation';

// ── Action → type mapping ─────────────────────────────────────────────────────
const ACTION_LABELS = {
  login:                   'Logged in',
  logout:                  'Logged out',
  password_changed:        'Changed password',
  pin_changed:             'Changed PIN',
  opened_account_settings: 'Opened account settings',
  exported_pdf:            'Exported PDF report',
  changed_date_filter:     'Changed date filter',
  filtered_by_channel:     'Filtered by channel',
  switched_calendar_view:  'Switched calendar view',
  opened_message_thread:   'Opened message thread',
  switched_property:       'Switched property',
  opened_messages_page:    'Opened Messages',
  sent_message:            'Sent a message',
  viewed_dashboard:        'Viewed dashboard',
  viewed_settings_tab:     'Viewed settings',
  changed_dashboard_period:'Changed dashboard period',
  booking_created:         'New booking confirmed',
  booking_modified:        'Booking modified',
  booking_cancelled:       'Booking cancelled',
  payment_received:        'Payment received',
  payment_refunded:        'Payment refunded',
};

function mapActionToType(action) {
  if (!action) return 'system';
  if (action === 'login' || action === 'logout') return 'login';
  if (['password_changed', 'pin_changed', 'opened_account_settings'].includes(action)) return 'settings';
  if (action.includes('book') || action.includes('reservation') || action.includes('check_in') || action.includes('check_out')) return 'booking';
  if (action.includes('pay') || action.includes('payment') || action.includes('invoice') || action.includes('refund')) return 'payment';
  return 'system';
}

function parseUA(ua) {
  if (!ua) return { browser: '—', os: '—', device: 'Unknown' };
  let browser = '—', os = '—', device = 'Desktop';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) { os = 'Android'; device = 'Mobile'; }
  else if (/iPhone|iPad/i.test(ua)) { os = 'iOS'; device = /iPad/i.test(ua) ? 'Tablet' : 'Mobile'; }
  else if (/Linux/i.test(ua)) os = 'Linux';
  if (/Mobile/i.test(ua)) device = 'Mobile';
  return { browser, os, device };
}

function formatIP(ip) {
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') return 'localhost';
  return ip.replace(/^::ffff:/, '');
}

function getEnvTag(ip) {
  if (!ip) return null;
  if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === 'localhost') return 'Dev';
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ip.replace(/^::ffff:/, ''))) return 'Internal';
  return 'Production';
}

function mapLog(log) {
  const first = log.performedBy?.firstName || '';
  const last  = log.performedBy?.lastName  || '';
  const name  = [first, last].filter(Boolean).join(' ') || log.performedBy?.email || 'Unknown';
  const rawRole = log.performedBy?.role || '';
  const role = rawRole === 'admin' ? 'Admin' : rawRole === 'staff' ? 'Leader' : rawRole === 'client' ? 'Client' : 'System';
  return {
    id:          log._id,
    type:        mapActionToType(log.action),
    description: ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    user:        name,
    email:       log.performedBy?.email || '',
    role,
    business:    log.businessName || '—',
    ip:          log.ipAddress    || '—',
    userAgent:   log.userAgent    || '',
    time:        log.createdAt,
  };
}

const TYPE_META = {
  login:    { label: 'Login',    color: '#1e8760', bg: '#eaf8f1', darkColor: '#4ade80', darkBg: '#0d2619', icon: 'M13 10H3M9 6l4 4-4 4M17 4v12' },
  booking:  { label: 'Booking',  color: '#2563eb', bg: '#eff6ff', darkColor: '#60a5fa', darkBg: '#0d1a2a', icon: 'M3 4h14a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zM1 8h18M7 2v4M13 2v4' },
  payment:  { label: 'Payment',  color: '#059669', bg: '#ecfdf5', darkColor: '#34d399', darkBg: '#052e16', icon: 'M2 5h16a1 1 0 011 1v9a1 1 0 01-1 1H2a1 1 0 01-1-1V6a1 1 0 011-1zM1 9h18M5 13h3' },
  settings: { label: 'Settings', color: '#7c3aed', bg: '#f5f3ff', darkColor: '#a78bfa', darkBg: '#1e1040', icon: 'M10 13a3 3 0 100-6 3 3 0 000 6zM10 2v2M10 16v2M2 10h2M16 10h2' },
  system:   { label: 'System',   color: '#6b7280', bg: '#f3f4f6', darkColor: '#9ca3af', darkBg: '#1f2937', icon: 'M9 3H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 2l4 4-7 7H7v-4l7-7z' },
};

const ROLE_META = {
  Admin:  { color: '#7c3aed', bg: '#f5f3ff', darkColor: '#a78bfa', darkBg: '#1e1040' },
  Client: { color: '#2563eb', bg: '#eff6ff', darkColor: '#60a5fa', darkBg: '#0d1a2a' },
  Leader: { color: '#d97706', bg: '#fffbeb', darkColor: '#fbbf24', darkBg: '#2a1f0a' },
  System: { color: '#6b7280', bg: '#f3f4f6', darkColor: '#9ca3af', darkBg: '#1f2937' },
};

const PAGE_SIZE = 8;

function computeSessionDurations(activities) {
  const map = {};
  const sorted = [...activities].sort((a, b) => new Date(a.time) - new Date(b.time));
  for (const act of sorted) {
    if (act.type !== 'login') continue;
    const logout = sorted.find(a => a.type === 'login' && a.description?.toLowerCase().includes('out') && a.email === act.email && new Date(a.time) > new Date(act.time));
    if (!logout) {
      const nextLogout = sorted.find(a => a.email === act.email && (a.description?.toLowerCase().includes('logged out') || a.description?.toLowerCase().includes('logout')) && new Date(a.time) > new Date(act.time));
      if (nextLogout) {
        const mins = Math.round((new Date(nextLogout.time) - new Date(act.time)) / 60000);
        if (mins > 0 && mins < 1440) map[act.id] = mins;
      }
    }
  }
  for (const act of sorted) {
    if (!act.description?.toLowerCase().includes('logged out') && !act.description?.toLowerCase().includes('logout')) continue;
    const login = [...sorted].reverse().find(a => a.email === act.email && (a.description?.toLowerCase().includes('logged in') || a.description?.toLowerCase().includes('login')) && a.type === 'login' && new Date(a.time) < new Date(act.time));
    if (login && !map[login.id]) {
      const mins = Math.round((new Date(act.time) - new Date(login.time)) / 60000);
      if (mins > 0 && mins < 1440) map[login.id] = mins;
    }
  }
  return map;
}

function fmtDuration(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getDatePreset(preset) {
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (preset === 'today') return { from: fmt(today), to: fmt(today) };
  if (preset === 'week') {
    const day = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return { from: fmt(mon), to: fmt(today) };
  }
  if (preset === 'month') return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) };
  return { from: '', to: '' };
}

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
}

const AV_COLORS = ['#1a9e6e','#2563eb','#7c3aed','#dc2626','#d97706','#0891b2'];
function avatarColor(name) {
  let h = 0; for (const c of name) h = name.charCodeAt(0) + ((h << 5) - h);
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RecentActivities() {
  const { dark } = useTheme();
  const [tab,    setTab]    = useState('all');
  const [search, setSearch] = useState('');
  const [role,   setRole]   = useState('');
  const [page,   setPage]   = useState(1);
  const [exportLoading, setExportLoading] = useState(false);
  const [datePreset, setDatePreset] = useState(null);
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');

  const [activities, setActivities] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchAllActivityLogs({ page: 1, limit: 200 })
      .then(data => {
        if (cancelled) return;
        setActivities((data.activityLog || []).map(mapLog));
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const tabScrollRef = useRef(null);
  const [tabScrollLeft, setTabScrollLeft] = useState(0);
  const [tabScrollable, setTabScrollable] = useState(false);

  function handleTabScroll() {
    const el = tabScrollRef.current;
    if (!el) return;
    setTabScrollLeft(el.scrollLeft);
    setTabScrollable(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }

  useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    setTabScrollable(el.scrollWidth > el.clientWidth);
  }, []);

  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const roleDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) setShowRoleDropdown(false);
    }
    if (showRoleDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRoleDropdown]);

  const ipList = useMemo(() => activities.map(a => a.ip), [activities]);
  const ipLocations = useIpLocations(ipList);

  const surface   = dark ? '#132a1e' : '#fff';
  const border    = dark ? '#1e3a2a' : '#e5e7eb';
  const textMain  = dark ? '#eaf5f0' : '#111827';
  const textMuted = dark ? '#7ab89a' : '#6b7280';
  const inputBg   = dark ? '#0d2619' : '#f9fafb';

  const tabs = [
    { id: 'all',      label: 'All',      count: activities.length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round"/></svg> },
    { id: 'login',    label: 'Logins',   count: activities.filter(a => a.type === 'login').length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 10H3M9 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 4v12" strokeLinecap="round"/></svg> },
    { id: 'booking',  label: 'Bookings', count: activities.filter(a => a.type === 'booking').length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round"/></svg> },
    { id: 'payment',  label: 'Payments', count: activities.filter(a => a.type === 'payment').length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="16" height="11" rx="2"/><path d="M2 9h16" strokeLinecap="round"/><rect x="5" y="12" width="3" height="2" rx="0.5" fill="currentColor" stroke="none"/></svg> },
    { id: 'settings', label: 'Settings', count: activities.filter(a => a.type === 'settings').length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" strokeLinecap="round"/></svg> },
    { id: 'system',   label: 'System',   count: activities.filter(a => a.type === 'system').length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="16" height="11" rx="2"/><path d="M6 17h8M10 14v3" strokeLinecap="round"/></svg> },
  ];

  const sessionDurations = useMemo(() => computeSessionDurations(activities), [activities]);

  const filtered = useMemo(() => {
    let list = activities;
    if (tab !== 'all') list = list.filter(a => a.type === tab);
    if (role)          list = list.filter(a => a.role === role);
    if (dateFrom) list = list.filter(a => a.time >= dateFrom);
    if (dateTo)   list = list.filter(a => a.time <= dateTo + 'T23:59:59');
    if (search)        list = list.filter(a =>
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.user.toLowerCase().includes(search.toLowerCase())        ||
      a.business.toLowerCase().includes(search.toLowerCase())    ||
      a.ip.includes(search)
    );
    return list;
  }, [activities, tab, search, role, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = search || role || dateFrom || dateTo;

  function handleTabChange(id) { setTab(id); setPage(1); }
  function handleSearch(v)     { setSearch(v); setPage(1); }
  function handleClear()       { setSearch(''); setRole(''); setDateFrom(''); setDateTo(''); setDatePreset(null); setPage(1); }
  function applyPreset(p)      { const r = getDatePreset(p); setDatePreset(p); setDateFrom(r.from); setDateTo(r.to); setPage(1); }

  function handleExport() {
    setExportLoading(true);
    const rows = [['Type','Description','User','Role','Business','IP','Time'],
      ...filtered.map(a => [a.type, a.description, a.user, a.role, a.business, a.ip, new Date(a.time).toLocaleString()])];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'recent-activities.csv'; link.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setExportLoading(false), 600);
  }


  return (
    <div className="db-layout">
      <Sidebar />
      <div className="db-main">
        <TopBar />
        <div className="cl-content">
          <style>{`
            @keyframes ra-spin { to { transform: rotate(360deg); } }
            @keyframes ra-enter { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
            .ra-row:hover { background: ${dark ? '#0d2619' : '#f8fffe'} !important; }
            .ra-tab-scroll::-webkit-scrollbar { display: none; }
            @media (max-width: 768px) {
              .ra-filter-bar { gap: 8px !important; }
              .ra-filter-bar .ra-filter-search {
                width: 100% !important; min-width: 0 !important; flex: unset !important;
              }
              .ra-filter-bar select { flex: 1; min-width: 0; }
            }
            .ra-export-btn {
              display: inline-flex; align-items: center; gap: 7px;
              padding: 8px 16px; border-radius: 9px; border: none;
              font-size: 0.82rem; font-weight: 600; white-space: nowrap;
              transition: background 0.15s; cursor: pointer;
            }
            .ra-export-label { display: inline; }
            @media (max-width: 768px) {
              .ra-export-btn {
                width: 38px; height: 38px; padding: 0;
                justify-content: center; border-radius: 12px;
              }
              .ra-export-label { display: none; }
            }
          `}</style>

          {/* ── Header ── */}
          <header className="cl-content__header" style={{ marginBottom: 16 }}>
            <div>
              <h1 className="cl-content__title">Recent Activities</h1>
              <p className="cl-content__sub">View all user actions, logins, bookings, payments, and system events</p>
            </div>
            <button
              onClick={handleExport}
              disabled={exportLoading || loading}
              className="ra-export-btn"
              style={{
                background: (exportLoading || loading) ? (dark ? '#0d2619' : '#e0e0e0') : '#1a9e6e',
                color: (exportLoading || loading) ? (dark ? '#4d8a6a' : '#aaa') : '#fff',
                cursor: (exportLoading || loading) ? 'not-allowed' : 'pointer',
                boxShadow: (exportLoading || loading) ? 'none' : '0 2px 8px rgba(26,158,110,0.20)',
              }}
              title="Export CSV"
            >
              {exportLoading
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ animation: 'ra-spin 0.8s linear infinite' }}><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                : <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 16h14" strokeLinecap="round"/></svg>
              }
              <span className="ra-export-label">{exportLoading ? 'Exporting…' : 'Export CSV'}</span>
            </button>
          </header>

          {/* ── Tab bar + card wrapper (single flex child to avoid cl-content gap) ── */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* ── Tab bar (outside card, transparent bg) ── */}
          <div style={{ position: 'sticky', top: 0, zIndex: 100, overflow: 'visible', background: dark ? '#0c1c14' : 'var(--color-bg, #f2f4f7)' }}>
            {tabScrollLeft > 0 && (
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 10, display: 'flex', alignItems: 'center', background: dark ? 'linear-gradient(to right, #0c1c14 60%, transparent)' : 'linear-gradient(to right, #f0f4f0 60%, transparent)', paddingRight: 8, paddingLeft: 2, pointerEvents: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2.5"><path d="M13 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            )}
            {tabScrollable && (
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10, display: 'flex', alignItems: 'center', background: dark ? 'linear-gradient(to left, #0c1c14 60%, transparent)' : 'linear-gradient(to left, #f0f4f0 60%, transparent)', paddingLeft: 8, paddingRight: 2, pointerEvents: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2.5"><path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            )}
            <div className="ra-tab-scroll" ref={tabScrollRef} onScroll={handleTabScroll} style={{ display: 'flex', alignItems: 'flex-end', background: 'transparent', marginBottom: '-1px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
              {tabs.map(t => {
                const active = tab === t.id;
                return (
                  <button key={t.id} onClick={() => handleTabChange(t.id)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '9px 18px 10px',
                    border: '1px solid',
                    borderColor: active ? (dark ? '#1e3a2a' : '#e8ecf0') : 'transparent',
                    borderBottom: active ? `1px solid ${surface}` : 'none',
                    borderRadius: '10px 10px 0 0',
                    background: active ? surface : 'transparent',
                    marginBottom: '-1px',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    fontSize: '0.82rem', fontWeight: 600,
                    color: active ? (dark ? '#26c47a' : '#10b981') : (dark ? '#4d8a6a' : '#9ca3af'),
                    transition: 'color 0.15s',
                    position: 'relative', zIndex: active ? 2 : 0,
                    boxShadow: 'none',
                  }}>
                    {t.icon}
                    {t.label}
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                      background: active ? (dark ? '#0d2619' : '#d1fae5') : 'transparent',
                      color: active ? (dark ? '#26c47a' : '#10b981') : (dark ? '#4d8a6a' : '#b0b7c3'),
                    }}>{loading ? '…' : t.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Card (tab-connected) ── */}
          <div style={{ background: surface, borderRadius: '0 12px 12px 12px', border: `1px solid ${border}`, overflow: 'hidden', boxShadow: dark ? '0 2px 12px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.06)', animation: 'ra-enter 0.2s ease' }}>

            {/* ── Filter bar ── */}
            <div className="ra-filter-bar" style={{ padding: '14px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="ra-filter-search" style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke={textMuted} strokeWidth="2" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search by user, activity, IP…"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 32px', borderRadius: 9, border: `1px solid ${border}`, background: inputBg, color: textMain, fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              <div ref={roleDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
                <div onClick={() => setShowRoleDropdown(v => !v)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 10px 7px 12px', borderRadius: 8,
                  border: `1px solid ${border}`, background: inputBg,
                  cursor: 'pointer', fontSize: '0.82rem',
                  color: role ? '#059669' : textMuted,
                  fontWeight: role ? 600 : 500,
                  userSelect: 'none', whiteSpace: 'nowrap',
                }}>
                  <span>{role || 'All Roles'}</span>
                  <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                {showRoleDropdown && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 300, background: surface, border: `1.5px solid ${border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 160, overflow: 'hidden' }}>
                    {[{ value: '', label: 'All Roles' }, { value: 'Admin', label: 'Admin' }, { value: 'Client', label: 'Client' }, { value: 'Leader', label: 'Team Leader' }, { value: 'System', label: 'System' }].map(opt => (
                      <div key={opt.value} onClick={() => { setRole(opt.value); setPage(1); setShowRoleDropdown(false); }} style={{
                        padding: '9px 14px', cursor: 'pointer', fontSize: '0.85rem',
                        background: role === opt.value ? (dark ? '#0d2619' : '#f0fdf4') : 'transparent',
                        color: role === opt.value ? '#059669' : (dark ? '#7ab89a' : '#374151'),
                        fontWeight: role === opt.value ? 600 : 400,
                        borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f7f7f7'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                        onMouseEnter={e => { if (role !== opt.value) e.currentTarget.style.background = dark ? '#132a1e' : '#f8faf9'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = role === opt.value ? (dark ? '#0d2619' : '#f0fdf4') : 'transparent'; }}
                      >
                        {opt.label}
                        {role === opt.value && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Date presets */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {[{ key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }].map(p => (
                  <button key={p.key} onClick={() => applyPreset(p.key)} style={{
                    padding: '5px 10px', borderRadius: 7, fontSize: '0.75rem', fontWeight: 600,
                    border: `1px solid ${datePreset === p.key ? '#1a9e6e' : border}`,
                    background: datePreset === p.key ? (dark ? '#0d2619' : '#eaf8f1') : 'transparent',
                    color: datePreset === p.key ? '#1a9e6e' : textMuted,
                    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.12s',
                  }}>{p.label}</button>
                ))}
              </div>
              {hasFilters && (
                <button onClick={handleClear} style={{ padding: '6px 10px', borderRadius: 7, border: `1px solid ${dark ? '#5c1a1a' : '#fca5a5'}`, background: dark ? '#2a0d0d' : '#fff5f5', color: '#dc2626', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                  ✕ Clear
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: textMuted, whiteSpace: 'nowrap' }}>
                {loading ? 'Loading…' : `${filtered.length} activit${filtered.length !== 1 ? 'ies' : 'y'}`}
              </span>
            </div>

            {/* ── Loading / error states ── */}
            {loading && (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: textMuted, fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ animation: 'ra-spin 0.8s linear infinite', flexShrink: 0 }}><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                Loading activities…
              </div>
            )}
            {!loading && error && (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: '#e84545', fontSize: '0.88rem' }}>
                ⚠ {error}
              </div>
            )}

            {/* ── Table ── */}
            {!loading && !error && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: dark ? '#0f2417' : '#f9fafb', borderBottom: `1px solid ${border}` }}>
                    {['Type','Activity','User','Business','Device / IP','Time'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: textMuted, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: textMuted, fontSize: '0.88rem' }}>
                      No activities found{hasFilters ? ' — try adjusting your filters' : ''}.
                    </td></tr>
                  ) : paginated.map((act, i) => {
                    const meta     = TYPE_META[act.type] || TYPE_META.system;
                    const roleMeta = ROLE_META[act.role] || ROLE_META.System;
                    return (
                      <tr key={act.id} className="ra-row" style={{ borderBottom: i < paginated.length - 1 ? `1px solid ${dark ? 'rgba(255,255,255,0.04)' : '#f3f4f6'}` : 'none', transition: 'background 0.12s' }}>
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 10px', borderRadius: 999,
                            background: dark ? meta.darkBg : meta.bg,
                            color: dark ? meta.darkColor : meta.color,
                            fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                          }}>
                            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d={meta.icon} strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {meta.label}
                          </span>
                        </td>
                        <td style={{ padding: '13px 16px', maxWidth: 260 }}>
                          <span style={{ color: textMain, fontWeight: 500 }}>{act.description}</span>
                          {sessionDurations[act.id] && (
                            <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, background: dark ? '#0d1a2a' : '#eff6ff', color: dark ? '#60a5fa' : '#2563eb', border: `1px solid ${dark ? '#1a3a5c' : '#bfdbfe'}` }}>
                              ⏱ {fmtDuration(sessionDurations[act.id])}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(act.user), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                              {getInitials(act.user)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: textMain, fontSize: '0.8rem' }}>{act.user}</div>
                              <div style={{ fontSize: '0.72rem', color: textMuted }}>{act.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '13px 16px', color: textMuted, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700,
                              background: dark ? roleMeta.darkBg : roleMeta.bg,
                              color: dark ? roleMeta.darkColor : roleMeta.color,
                            }}>{act.role}</span>
                          </div>
                        </td>
                        <td style={{ padding: '13px 16px', color: textMuted, fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          {act.business !== '—' ? act.business : <span style={{ color: dark ? '#2d5c3e' : '#d1d5db' }}>—</span>}
                        </td>
                        <td style={{ padding: '13px 16px' }}>
                          {(() => {
                            const ua = parseUA(act.userAgent);
                            const ip = formatIP(act.ip);
                            const env = getEnvTag(act.ip);
                            const loc = formatLocation(act.ip, ipLocations);
                            return (
                              <div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 500, color: textMain }}>{ua.browser} · {ua.os}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.7rem', color: textMuted, fontFamily: 'monospace' }}>{ip}</span>
                                  {env && (
                                    <span style={{
                                      padding: '0px 5px', borderRadius: 4, fontSize: '0.6rem', fontWeight: 700,
                                      background: env === 'Dev' ? (dark ? '#2a1f0a' : '#fffbeb') : env === 'Internal' ? (dark ? '#0d1a2a' : '#eff6ff') : (dark ? '#052e16' : '#f0fdf4'),
                                      color: env === 'Dev' ? (dark ? '#fbbf24' : '#d97706') : env === 'Internal' ? (dark ? '#60a5fa' : '#2563eb') : (dark ? '#4ade80' : '#16a34a'),
                                    }}>{env}</span>
                                  )}
                                </div>
                                {loc && (
                                  <div style={{ fontSize: '0.7rem', color: dark ? '#26c47a' : '#059669', fontWeight: 500, marginTop: 2 }}>
                                    📍 {loc}
                                  </div>
                                )}
                                <div style={{ fontSize: '0.68rem', color: dark ? '#4d8a6a' : '#b0b7c3', marginTop: 1 }}>{timeAgo(act.time)}</div>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}

            {/* ── Pagination ── */}
            {!loading && !error && totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: `1px solid ${border}` }}>
                <span style={{ fontSize: '0.75rem', color: dark ? '#4d8a6a' : '#9ca3af' }}>Page {page} of {totalPages} · {filtered.length} activit{filtered.length !== 1 ? 'ies' : 'y'}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['prev', page === 1, () => setPage(p => Math.max(1, p - 1))], ['next', page === totalPages, () => setPage(p => Math.min(totalPages, p + 1))]].map(([dir, disabled, onClick]) => (
                    <button key={dir} onClick={onClick} disabled={disabled}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`, background: disabled ? (dark ? '#0a1a10' : '#f9fafb') : (dark ? '#0d2619' : '#fff'), color: disabled ? (dark ? '#2a4a35' : '#d1d5db') : (dark ? '#7ab89a' : '#374151'), fontSize: '0.78rem', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.15s', fontFamily: 'inherit' }}
                      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = dark ? '#132a1e' : '#f3f4f6'; }}
                      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = disabled ? (dark ? '#0a1a10' : '#f9fafb') : (dark ? '#0d2619' : '#fff'); }}
                    >
                      {dir === 'prev' && <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      {dir === 'prev' ? 'Prev' : 'Next'}
                      {dir === 'next' && <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>{/* end tab+card wrapper */}
        </div>
      </div>
    </div>
  );
}
