import { useState, useMemo, useRef, useEffect } from 'react';
import Sidebar from '../Sidebar';
import TopBar from '../dashboard/components/TopBar';
import { useTheme } from '../../context/ThemeContext';

// ── Sample data ───────────────────────────────────────────────────────────────
const SAMPLE_ALERTS = [
  { id: 1,  severity: 'critical', title: 'Database Connection Lost',      message: 'Primary database server is unreachable. Fallback initiated.',         source: 'System',    time: '2026-06-16T08:14:00', status: 'active',   category: 'infrastructure' },
  { id: 2,  severity: 'critical', title: 'Payment Gateway Timeout',       message: 'Stripe webhook endpoint returning 503 for the past 8 minutes.',        source: 'Payments',  time: '2026-06-16T07:55:00', status: 'active',   category: 'payments' },
  { id: 3,  severity: 'warning',  title: 'High Memory Usage',             message: 'Server memory usage at 87%. Consider scaling resources.',              source: 'Server',    time: '2026-06-16T07:40:00', status: 'active',   category: 'infrastructure' },
  { id: 4,  severity: 'warning',  title: 'Slow API Response',             message: 'Average response time exceeded 2000ms on /api/bookings endpoint.',     source: 'API',       time: '2026-06-16T07:20:00', status: 'active',   category: 'performance' },
  { id: 5,  severity: 'warning',  title: 'Failed Login Attempts Spike',   message: '23 failed login attempts detected from IP 192.168.1.45 in 5 minutes.',  source: 'Security',  time: '2026-06-16T06:58:00', status: 'resolved', category: 'security' },
  { id: 6,  severity: 'info',     title: 'Scheduled Maintenance Tonight', message: 'System maintenance scheduled for 2026-06-16 at 23:00 PHT (2 hrs).',    source: 'System',    time: '2026-06-16T06:30:00', status: 'active',   category: 'maintenance' },
  { id: 7,  severity: 'info',     title: 'New Admin Account Created',     message: 'Admin account for "Jane Dela Cruz" was created by Innovation Admin.',   source: 'Accounts',  time: '2026-06-16T05:45:00', status: 'active',   category: 'accounts' },
  { id: 8,  severity: 'critical', title: 'SSL Certificate Expiring',      message: 'SSL certificate for hostops.online expires in 3 days.',                source: 'Security',  time: '2026-06-15T22:10:00', status: 'resolved', category: 'security' },
  { id: 9,  severity: 'warning',  title: 'Disk Space Low',                message: 'Server disk at 92% capacity. Archive or delete old log files.',        source: 'Server',    time: '2026-06-15T20:30:00', status: 'resolved', category: 'infrastructure' },
  { id: 10, severity: 'info',     title: 'Backup Completed',              message: 'Nightly database backup completed successfully (4.2 GB).',             source: 'System',    time: '2026-06-15T02:00:00', status: 'resolved', category: 'system' },
  { id: 11, severity: 'info',     title: 'New Business Registered',       message: 'Business "Haido Ville" submitted a registration request.',             source: 'Businesses',time: '2026-06-15T14:22:00', status: 'active',   category: 'accounts' },
  { id: 12, severity: 'warning',  title: 'Smoobu Sync Failed',            message: 'Property sync for Business ID #1082 failed after 3 retries.',         source: 'Integration',time:'2026-06-15T12:05:00', status: 'active',   category: 'integration' },
  { id: 13, severity: 'critical', title: 'Unauthorized API Access',       message: 'API key used from unrecognized IP 45.134.10.22. Key revoked.',         source: 'Security',  time: '2026-06-15T09:18:00', status: 'resolved', category: 'security' },
  { id: 14, severity: 'info',     title: 'User Password Reset',           message: 'Password reset requested for user zodiacanxs28@gmail.com.',            source: 'Auth',      time: '2026-06-15T08:40:00', status: 'resolved', category: 'accounts' },
  { id: 15, severity: 'warning',  title: 'Rate Limit Approached',         message: 'Smoobu API rate limit at 82% for today. Requests will slow.',          source: 'Integration',time:'2026-06-14T17:55:00', status: 'resolved', category: 'integration' },
  { id: 16, severity: 'info',     title: 'Monthly Report Generated',      message: 'May 2026 activity report generated and sent to admin email.',           source: 'Reports',   time: '2026-06-01T00:05:00', status: 'resolved', category: 'system' },
];

const SEVERITY_META = {
  critical: { label: 'Critical', color: '#dc2626', bg: '#fef2f2', darkColor: '#f87171', darkBg: '#2a0d0d', border: '#fecaca', darkBorder: '#5c1a1a' },
  warning:  { label: 'Warning',  color: '#d97706', bg: '#fffbeb', darkColor: '#fbbf24', darkBg: '#2a1f0a', border: '#fde68a', darkBorder: '#5c3a0a' },
  info:     { label: 'Info',     color: '#2563eb', bg: '#eff6ff', darkColor: '#60a5fa', darkBg: '#0d1a2a', border: '#bfdbfe', darkBorder: '#1a3a5c' },
};

const STATUS_META = {
  active:   { label: 'Active',   color: '#dc2626', darkColor: '#f87171' },
  resolved: { label: 'Resolved', color: '#16a34a', darkColor: '#4ade80' },
};

const PAGE_SIZE = 8;

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function SeverityIcon({ severity }) {
  const s = { width: 14, height: 14, flexShrink: 0 };
  if (severity === 'critical') return (
    <svg {...s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="10" cy="10" r="8"/><path d="M10 6v5M10 13.5v.5" strokeLinecap="round"/>
    </svg>
  );
  if (severity === 'warning') return (
    <svg {...s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 3L2 17h16L10 3z" strokeLinejoin="round"/><path d="M10 9v3.5M10 14.2v.3" strokeLinecap="round"/>
    </svg>
  );
  return (
    <svg {...s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="10" cy="10" r="8"/><path d="M10 9v5M10 6.5v.5" strokeLinecap="round"/>
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AlertsCenter() {
  const { dark } = useTheme();
  const [tab,    setTab]    = useState('all');
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [status,   setStatus]   = useState('');
  const [page, setPage] = useState(1);
  const [exportLoading, setExportLoading] = useState(false);

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

  const [showSevDropdown, setShowSevDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const sevDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (sevDropdownRef.current && !sevDropdownRef.current.contains(e.target)) setShowSevDropdown(false);
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) setShowStatusDropdown(false);
    }
    if (showSevDropdown || showStatusDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSevDropdown, showStatusDropdown]);

  const surface   = dark ? '#132a1e' : '#fff';
  const border    = dark ? '#1e3a2a' : '#e5e7eb';
  const textMain  = dark ? '#eaf5f0' : '#111827';
  const textMuted = dark ? '#7ab89a' : '#6b7280';
  const inputBg   = dark ? '#0d2619' : '#f9fafb';

  const tabs = [
    { id: 'all',      label: 'All',      count: SAMPLE_ALERTS.length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round"/></svg> },
    { id: 'critical', label: 'Critical', count: SAMPLE_ALERTS.filter(a => a.severity === 'critical').length, warn: true,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="8"/><path d="M10 6v5M10 13.5v.5" strokeLinecap="round"/></svg> },
    { id: 'warning',  label: 'Warning',  count: SAMPLE_ALERTS.filter(a => a.severity === 'warning').length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3L2 17h16L10 3z" strokeLinejoin="round"/><path d="M10 9v3M10 14v.5" strokeLinecap="round"/></svg> },
    { id: 'info',     label: 'Info',     count: SAMPLE_ALERTS.filter(a => a.severity === 'info').length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="8"/><path d="M10 9v5M10 6.5v.5" strokeLinecap="round"/></svg> },
    { id: 'resolved', label: 'Resolved', count: SAMPLE_ALERTS.filter(a => a.status === 'resolved').length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="8"/><path d="M7 10l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  ];

  const filtered = useMemo(() => {
    let list = SAMPLE_ALERTS;
    if (tab === 'resolved') list = list.filter(a => a.status === 'resolved');
    else if (tab !== 'all') list = list.filter(a => a.severity === tab);
    if (severity) list = list.filter(a => a.severity === severity);
    if (status)   list = list.filter(a => a.status === status);
    if (search)   list = list.filter(a =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.message.toLowerCase().includes(search.toLowerCase()) ||
      a.source.toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [tab, search, severity, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleTabChange(id) { setTab(id); setPage(1); }
  function handleSearch(v)     { setSearch(v); setPage(1); }
  function handleClear()       { setSearch(''); setSeverity(''); setStatus(''); setPage(1); }

  function handleExport() {
    setExportLoading(true);
    const rows = [['Severity','Title','Message','Source','Time','Status'],
      ...filtered.map(a => [a.severity, a.title, a.message, a.source, new Date(a.time).toLocaleString(), a.status])];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'alerts-center.csv'; link.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setExportLoading(false), 600);
  }

  const hasFilters = search || severity || status;

  return (
    <div className="db-layout">
      <Sidebar />
      <div className="db-main">
        <TopBar />
        <div className="cl-content">
          <style>{`
            @keyframes al-spin { to { transform: rotate(360deg); } }
            @keyframes al-enter { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
            .al-row:hover { background: ${dark ? '#0d2619' : '#f8fffe'} !important; }
            .al-tab-scroll::-webkit-scrollbar { display: none; }
            @media (max-width: 768px) {
              .al-filter-bar { gap: 8px !important; }
              .al-filter-bar .al-filter-search {
                width: 100% !important; min-width: 0 !important; flex: unset !important;
              }
              .al-filter-bar select { flex: 1; min-width: 0; }
            }
            .al-export-btn {
              display: inline-flex; align-items: center; gap: 7px;
              padding: 8px 16px; border-radius: 9px; border: none;
              font-size: 0.82rem; font-weight: 600; white-space: nowrap;
              transition: background 0.15s; cursor: pointer;
            }
            .al-export-label { display: inline; }
            @media (max-width: 768px) {
              .al-export-btn {
                width: 38px; height: 38px; padding: 0;
                justify-content: center; border-radius: 12px;
              }
              .al-export-label { display: none; }
            }
          `}</style>

          {/* ── Header ── */}
          <header className="cl-content__header" style={{ marginBottom: 16 }}>
            <div>
              <h1 className="cl-content__title">Alerts Center</h1>
              <p className="cl-content__sub">Monitor system alerts, warnings, and critical events in real-time</p>
            </div>
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="al-export-btn"
              style={{
                background: exportLoading ? (dark ? '#0d2619' : '#e0e0e0') : '#1a9e6e',
                color: exportLoading ? (dark ? '#4d8a6a' : '#aaa') : '#fff',
                cursor: exportLoading ? 'not-allowed' : 'pointer',
                boxShadow: exportLoading ? 'none' : '0 2px 8px rgba(26,158,110,0.20)',
              }}
              title="Export CSV"
            >
              {exportLoading
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ animation: 'al-spin 0.8s linear infinite' }}><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                : <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 16h14" strokeLinecap="round"/></svg>
              }
              <span className="al-export-label">{exportLoading ? 'Exporting…' : 'Export CSV'}</span>
            </button>
          </header>

          {/* ── Tab bar + card wrapper (single flex child to avoid cl-content gap) ── */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* ── Tab bar (outside card, transparent bg) ── */}
          <div style={{ position: 'sticky', top: 0, zIndex: 100, overflowX: 'clip', overflowY: 'visible', background: dark ? '#0c1c14' : 'var(--color-bg, #f2f4f7)' }}>
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
            <div className="al-tab-scroll" ref={tabScrollRef} onScroll={handleTabScroll} style={{ display: 'flex', alignItems: 'flex-end', background: 'transparent', marginBottom: '-1px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
              {tabs.map(t => {
                const active = tab === t.id;
                const activeColor = t.warn ? (dark ? '#f87171' : '#dc2626') : (dark ? '#26c47a' : '#10b981');
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
                    color: active ? activeColor : (dark ? '#4d8a6a' : '#9ca3af'),
                    transition: 'color 0.15s',
                    position: 'relative', zIndex: active ? 2 : 0,
                    boxShadow: 'none',
                  }}>
                    {t.icon}
                    {t.label}
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                      background: t.warn
                        ? (active ? (dark ? '#2a0d0d' : '#fef2f2') : 'transparent')
                        : (active ? (dark ? '#0d2619' : '#d1fae5') : 'transparent'),
                      color: t.warn
                        ? (active ? (dark ? '#f87171' : '#dc2626') : (dark ? '#4d8a6a' : '#b0b7c3'))
                        : (active ? activeColor : (dark ? '#4d8a6a' : '#b0b7c3')),
                    }}>{t.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Card (tab-connected) ── */}
          <div style={{ background: surface, borderRadius: '0 12px 12px 12px', border: `1px solid ${border}`, overflow: 'hidden', boxShadow: dark ? '0 2px 12px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.06)', animation: 'al-enter 0.2s ease' }}>

            {/* ── Filter bar ── */}
            <div className="al-filter-bar" style={{ padding: '14px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Search */}
              <div className="al-filter-search" style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke={textMuted} strokeWidth="2" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search alerts…"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 32px', borderRadius: 9, border: `1px solid ${border}`, background: inputBg, color: textMain, fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              {/* Severity filter */}
              <div ref={sevDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
                <div onClick={() => { setShowSevDropdown(v => !v); setShowStatusDropdown(false); }} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 10px 7px 12px', borderRadius: 8,
                  border: `1px solid ${border}`, background: inputBg,
                  cursor: 'pointer', fontSize: '0.82rem',
                  color: severity ? '#059669' : textMuted,
                  fontWeight: severity ? 600 : 500,
                  userSelect: 'none', whiteSpace: 'nowrap',
                }}>
                  <span>{severity ? (severity.charAt(0).toUpperCase() + severity.slice(1)) : 'All Severities'}</span>
                  <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                {showSevDropdown && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 300, background: surface, border: `1.5px solid ${border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 170, overflow: 'hidden' }}>
                    {[{ value: '', label: 'All Severities' }, { value: 'critical', label: 'Critical' }, { value: 'warning', label: 'Warning' }, { value: 'info', label: 'Info' }].map(opt => (
                      <div key={opt.value} onClick={() => { setSeverity(opt.value); setPage(1); setShowSevDropdown(false); }} style={{
                        padding: '9px 14px', cursor: 'pointer', fontSize: '0.85rem',
                        background: severity === opt.value ? (dark ? '#0d2619' : '#f0fdf4') : 'transparent',
                        color: severity === opt.value ? '#059669' : (dark ? '#7ab89a' : '#374151'),
                        fontWeight: severity === opt.value ? 600 : 400,
                        borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f7f7f7'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                        onMouseEnter={e => { if (severity !== opt.value) e.currentTarget.style.background = dark ? '#132a1e' : '#f8faf9'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = severity === opt.value ? (dark ? '#0d2619' : '#f0fdf4') : 'transparent'; }}
                      >
                        {opt.label}
                        {severity === opt.value && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Status filter */}
              <div ref={statusDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
                <div onClick={() => { setShowStatusDropdown(v => !v); setShowSevDropdown(false); }} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 10px 7px 12px', borderRadius: 8,
                  border: `1px solid ${border}`, background: inputBg,
                  cursor: 'pointer', fontSize: '0.82rem',
                  color: status ? '#059669' : textMuted,
                  fontWeight: status ? 600 : 500,
                  userSelect: 'none', whiteSpace: 'nowrap',
                }}>
                  <span>{status ? (status.charAt(0).toUpperCase() + status.slice(1)) : 'All Status'}</span>
                  <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                {showStatusDropdown && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 300, background: surface, border: `1.5px solid ${border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 160, overflow: 'hidden' }}>
                    {[{ value: '', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'resolved', label: 'Resolved' }].map(opt => (
                      <div key={opt.value} onClick={() => { setStatus(opt.value); setPage(1); setShowStatusDropdown(false); }} style={{
                        padding: '9px 14px', cursor: 'pointer', fontSize: '0.85rem',
                        background: status === opt.value ? (dark ? '#0d2619' : '#f0fdf4') : 'transparent',
                        color: status === opt.value ? '#059669' : (dark ? '#7ab89a' : '#374151'),
                        fontWeight: status === opt.value ? 600 : 400,
                        borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f7f7f7'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                        onMouseEnter={e => { if (status !== opt.value) e.currentTarget.style.background = dark ? '#132a1e' : '#f8faf9'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = status === opt.value ? (dark ? '#0d2619' : '#f0fdf4') : 'transparent'; }}
                      >
                        {opt.label}
                        {status === opt.value && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {hasFilters && (
                <button onClick={handleClear} style={{ padding: '8px 14px', borderRadius: 9, border: `1px solid ${border}`, background: 'transparent', color: textMuted, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                  Clear
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: textMuted, whiteSpace: 'nowrap' }}>
                {filtered.length} alert{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* ── Table ── */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: dark ? '#0f2417' : '#f9fafb', borderBottom: `1px solid ${border}` }}>
                    {['Severity','Title','Source','Time','Status',''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: textMuted, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: textMuted, fontSize: '0.88rem' }}>
                      No alerts found{hasFilters ? ' — try adjusting your filters' : ''}.
                    </td></tr>
                  ) : paginated.map((alert, i) => {
                    const meta   = SEVERITY_META[alert.severity];
                    const stMeta = STATUS_META[alert.status];
                    return (
                      <tr key={alert.id} className="al-row" style={{ borderBottom: i < paginated.length - 1 ? `1px solid ${dark ? 'rgba(255,255,255,0.04)' : '#f3f4f6'}` : 'none', transition: 'background 0.12s', cursor: 'default' }}>
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 10px', borderRadius: 999,
                            background: dark ? meta.darkBg : meta.bg,
                            color: dark ? meta.darkColor : meta.color,
                            border: `1px solid ${dark ? meta.darkBorder : meta.border}`,
                            fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.04em',
                          }}>
                            <SeverityIcon severity={alert.severity} />
                            {meta.label}
                          </span>
                        </td>
                        <td style={{ padding: '13px 16px', maxWidth: 280 }}>
                          <div style={{ fontWeight: 600, color: textMain, marginBottom: 2 }}>{alert.title}</div>
                          <div style={{ color: textMuted, fontSize: '0.78rem', lineHeight: 1.4 }}>{alert.message}</div>
                        </td>
                        <td style={{ padding: '13px 16px', color: textMuted, whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dark ? '#26c47a' : '#1a9e6e', flexShrink: 0 }} />
                            {alert.source}
                          </span>
                        </td>
                        <td style={{ padding: '13px 16px', color: textMuted, whiteSpace: 'nowrap', fontSize: '0.79rem' }}>
                          <span title={new Date(alert.time).toLocaleString()}>{timeAgo(alert.time)}</span>
                        </td>
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.78rem', color: dark ? stMeta.darkColor : stMeta.color }}>
                            {alert.status === 'active' ? '● Active' : '✓ Resolved'}
                          </span>
                        </td>
                        <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                          {alert.status === 'active' && (
                            <button style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${border}`, background: 'transparent', color: textMuted, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                              Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: `1px solid ${border}`, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: '0.78rem', color: textMuted }}>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: page === 1 ? (dark ? '#2d5c3e' : '#d1d5db') : textMuted, cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}>
                    ← Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).filter(n => Math.abs(n - page) <= 2).map(n => (
                    <button key={n} onClick={() => setPage(n)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${n === page ? (dark ? '#26c47a' : '#1a9e6e') : border}`, background: n === page ? (dark ? '#0d2619' : '#f0faf6') : 'transparent', color: n === page ? (dark ? '#26c47a' : '#1a9e6e') : textMuted, fontWeight: n === page ? 700 : 400, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: page === totalPages ? (dark ? '#2d5c3e' : '#d1d5db') : textMuted, cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}>
                    Next →
                  </button>
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
