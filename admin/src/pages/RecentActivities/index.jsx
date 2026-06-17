import { useState, useMemo, useRef, useEffect } from 'react';
import Sidebar from '../Sidebar';
import TopBar from '../dashboard/components/TopBar';
import { useTheme } from '../../context/ThemeContext';

// ── Sample data ───────────────────────────────────────────────────────────────
const SAMPLE_ACTIVITIES = [
  { id: 1,  type: 'login',    description: 'Logged into admin panel',          user: 'Houston Harvey',    email: 'houstonharvey289@gmail.com',   role: 'Admin',    business: '—',           ip: '112.200.14.8',   time: '2026-06-16T08:30:00' },
  { id: 2,  type: 'booking',  description: 'New booking confirmed — Room 302', user: 'Raul Dela',         email: 'exodianxies@gmail.com',        role: 'Client',   business: 'Haido Ville', ip: '175.45.22.9',    time: '2026-06-16T08:12:00' },
  { id: 3,  type: 'payment',  description: 'Payment received ₱4,500.00',       user: 'Knesss',            email: 'valhalla.leo0@gmail.com',      role: 'Client',   business: 'Haido Ville', ip: '103.56.11.4',    time: '2026-06-16T07:58:00' },
  { id: 4,  type: 'settings', description: 'Changed account password',         user: 'Innovation Admin',  email: 'h.sarmiento@telexph.com',      role: 'Admin',    business: '—',           ip: '112.200.14.8',   time: '2026-06-16T07:44:00' },
  { id: 5,  type: 'login',    description: 'Logged into client portal',        user: 'Astra',             email: 'dkosalvation49@gmail.com',     role: 'Client',   business: 'Haido Ville', ip: '45.132.8.22',    time: '2026-06-16T07:30:00' },
  { id: 6,  type: 'booking',  description: 'Booking cancellation requested',   user: 'RayCease',          email: 'lakesapphire121@gmail.com',    role: 'Client',   business: '—',           ip: '182.3.45.100',   time: '2026-06-16T07:10:00' },
  { id: 7,  type: 'system',   description: 'Exported activity logs PDF',       user: 'Innovation Admin',  email: 'h.sarmiento@telexph.com',      role: 'Admin',    business: '—',           ip: '112.200.14.8',   time: '2026-06-16T06:55:00' },
  { id: 8,  type: 'payment',  description: 'Refund processed ₱2,200.00',       user: 'Andoks',            email: 'eclipsavali@gmail.com',        role: 'Client',   business: 'Haido Ville', ip: '120.28.77.5',    time: '2026-06-16T06:40:00' },
  { id: 9,  type: 'login',    description: 'Logged into team leader portal',   user: 'Houston Harvey',    email: 'houstonharvey289@gmail.com',   role: 'Leader',   business: '—',           ip: '112.200.14.8',   time: '2026-06-16T06:22:00' },
  { id: 10, type: 'settings', description: 'Updated PIN code',                 user: 'Knesss',            email: 'valhalla.leo0@gmail.com',      role: 'Client',   business: 'Haido Ville', ip: '103.56.11.4',    time: '2026-06-16T06:00:00' },
  { id: 11, type: 'booking',  description: 'Check-in confirmed — Villa A',     user: 'Astra',             email: 'dkosalvation49@gmail.com',     role: 'Client',   business: 'Haido Ville', ip: '45.132.8.22',    time: '2026-06-15T22:30:00' },
  { id: 12, type: 'system',   description: 'Staff account created',            user: 'Innovation Admin',  email: 'h.sarmiento@telexph.com',      role: 'Admin',    business: '—',           ip: '112.200.14.8',   time: '2026-06-15T21:15:00' },
  { id: 13, type: 'payment',  description: 'Payment failed — card declined',   user: 'RayCease',          email: 'lakesapphire121@gmail.com',    role: 'Client',   business: '—',           ip: '182.3.45.100',   time: '2026-06-15T20:40:00' },
  { id: 14, type: 'login',    description: 'Logged into admin panel',          user: 'Innovation Admin',  email: 'h.sarmiento@telexph.com',      role: 'Admin',    business: '—',           ip: '112.200.14.8',   time: '2026-06-15T18:00:00' },
  { id: 15, type: 'settings', description: 'Smoobu API key updated',           user: 'Innovation Admin',  email: 'h.sarmiento@telexph.com',      role: 'Admin',    business: 'Haido Ville', ip: '112.200.14.8',   time: '2026-06-15T16:30:00' },
  { id: 16, type: 'booking',  description: 'Check-out completed — Room 205',   user: 'Andoks',            email: 'eclipsavali@gmail.com',        role: 'Client',   business: 'Haido Ville', ip: '120.28.77.5',    time: '2026-06-15T12:00:00' },
  { id: 17, type: 'system',   description: 'Monthly report generated',         user: 'System',            email: '—',                            role: 'System',   business: '—',           ip: '127.0.0.1',      time: '2026-06-01T00:05:00' },
  { id: 18, type: 'payment',  description: 'Invoice sent ₱8,750.00',           user: 'Innovation Admin',  email: 'h.sarmiento@telexph.com',      role: 'Admin',    business: 'Haido Ville', ip: '112.200.14.8',   time: '2026-06-15T09:20:00' },
];

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

  const surface   = dark ? '#132a1e' : '#fff';
  const border    = dark ? '#1e3a2a' : '#e5e7eb';
  const textMain  = dark ? '#eaf5f0' : '#111827';
  const textMuted = dark ? '#7ab89a' : '#6b7280';
  const inputBg   = dark ? '#0d2619' : '#f9fafb';

  const tabs = [
    { id: 'all',      label: 'All',      count: SAMPLE_ACTIVITIES.length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round"/></svg> },
    { id: 'login',    label: 'Logins',   count: SAMPLE_ACTIVITIES.filter(a => a.type === 'login').length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 10H3M9 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 4v12" strokeLinecap="round"/></svg> },
    { id: 'booking',  label: 'Bookings', count: SAMPLE_ACTIVITIES.filter(a => a.type === 'booking').length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round"/></svg> },
    { id: 'payment',  label: 'Payments', count: SAMPLE_ACTIVITIES.filter(a => a.type === 'payment').length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="16" height="11" rx="2"/><path d="M2 9h16" strokeLinecap="round"/><rect x="5" y="12" width="3" height="2" rx="0.5" fill="currentColor" stroke="none"/></svg> },
    { id: 'settings', label: 'Settings', count: SAMPLE_ACTIVITIES.filter(a => a.type === 'settings').length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" strokeLinecap="round"/></svg> },
    { id: 'system',   label: 'System',   count: SAMPLE_ACTIVITIES.filter(a => a.type === 'system').length,
      icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="16" height="11" rx="2"/><path d="M6 17h8M10 14v3" strokeLinecap="round"/></svg> },
  ];

  const filtered = useMemo(() => {
    let list = SAMPLE_ACTIVITIES;
    if (tab !== 'all') list = list.filter(a => a.type === tab);
    if (role)          list = list.filter(a => a.role === role);
    if (search)        list = list.filter(a =>
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.user.toLowerCase().includes(search.toLowerCase())        ||
      a.business.toLowerCase().includes(search.toLowerCase())    ||
      a.ip.includes(search)
    );
    return list;
  }, [tab, search, role]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleTabChange(id) { setTab(id); setPage(1); }
  function handleSearch(v)     { setSearch(v); setPage(1); }
  function handleClear()       { setSearch(''); setRole(''); setPage(1); }

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

  const hasFilters = search || role;

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
              disabled={exportLoading}
              className="ra-export-btn"
              style={{
                background: exportLoading ? (dark ? '#0d2619' : '#e0e0e0') : '#1a9e6e',
                color: exportLoading ? (dark ? '#4d8a6a' : '#aaa') : '#fff',
                cursor: exportLoading ? 'not-allowed' : 'pointer',
                boxShadow: exportLoading ? 'none' : '0 2px 8px rgba(26,158,110,0.20)',
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
                    }}>{t.count}</span>
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
              <select value={role} onChange={e => { setRole(e.target.value); setPage(1); }} style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${border}`, background: inputBg, color: textMain, fontSize: '0.82rem', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                <option value="">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="Client">Client</option>
                <option value="Leader">Team Leader</option>
                <option value="System">System</option>
              </select>
              {hasFilters && (
                <button onClick={handleClear} style={{ padding: '8px 14px', borderRadius: 9, border: `1px solid ${border}`, background: 'transparent', color: textMuted, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                  Clear
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: textMuted, whiteSpace: 'nowrap' }}>
                {filtered.length} activit{filtered.length !== 1 ? 'ies' : 'y'}
              </span>
            </div>

            {/* ── Table ── */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: dark ? '#0f2417' : '#f9fafb', borderBottom: `1px solid ${border}` }}>
                    {['Type','Activity','User','Business','IP Address','Time'].map(h => (
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
                        <td style={{ padding: '13px 16px', color: textMuted, fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {act.ip}
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
