import { useState, useEffect, useRef } from 'react';
import Sidebar from '../Sidebar';
import TopBar from '../dashboard/components/TopBar';
import { useTheme } from '../../context/ThemeContext';
import { fetchWithAuth } from '../../lib/authUtils';

const API_BASE = (import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

const SEV_META = {
  critical: { label: 'Critical', color: '#ef4444', bg: '#fef2f2', darkBg: '#2a0d0d', darkColor: '#f87171' },
  high:     { label: 'High',     color: '#f97316', bg: '#fff7ed', darkBg: '#2a1a0a', darkColor: '#fb923c' },
  medium:   { label: 'Medium',   color: '#f59e0b', bg: '#fffbeb', darkBg: '#2a1f0a', darkColor: '#fbbf24' },
  low:      { label: 'Low',      color: '#22c55e', bg: '#f0fdf4', darkBg: '#052e16', darkColor: '#4ade80' },
};

const STATUS_META = {
  open:        { label: 'Open',        color: '#ef4444', bg: '#fef2f2', darkBg: '#2a0d0d', darkColor: '#f87171' },
  in_progress: { label: 'In Progress', color: '#f59e0b', bg: '#fffbeb', darkBg: '#2a1f0a', darkColor: '#fbbf24' },
  sent:        { label: 'Sent',        color: '#2563eb', bg: '#eff6ff', darkBg: '#1e3a5f', darkColor: '#60a5fa' },
  resolved:    { label: 'Resolved',    color: '#22c55e', bg: '#f0fdf4', darkBg: '#052e16', darkColor: '#4ade80' },
  dismissed:   { label: 'Dismissed',   color: '#6b7280', bg: '#f3f4f6', darkBg: '#1f2937', darkColor: '#9ca3af' },
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
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
}

function displayName(r) {
  const n = r.name || '';
  const e = r.email || '';
  if (n && n !== e && !n.includes('@')) return n;
  if (e) {
    const local = e.split('@')[0];
    return local.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  return '—';
}

const AV_COLORS = ['#1a9e6e','#2563eb','#7c3aed','#dc2626','#d97706','#0891b2'];
function avatarColor(name) {
  let h = 0; for (const c of (name || '')) h = c.charCodeAt(0) + ((h << 5) - h);
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}

export default function BugReportsPage() {
  const { dark } = useTheme();
  const [reports, setReports]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [tab, setTab]           = useState('all');
  const [search, setSearch]     = useState('');
  const [sevFilter, setSevFilter]       = useState('');
  const [page, setPage]         = useState(1);
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);

  const [inbox, setInbox]               = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError]     = useState('');
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadLoading, setThreadLoading]   = useState(false);

  const [replyText, setReplyText]       = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replySent, setReplySent]       = useState(false);


  const surface  = dark ? '#132a1e' : '#fff';
  const border   = dark ? '#1e3a2a' : '#e5e7eb';
  const textMain = dark ? '#eaf5f0' : '#111827';
  const textMuted = dark ? '#7ab89a' : '#6b7280';
  const inputBg  = dark ? '#0d2619' : '#f9fafb';

  async function loadReports() {
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/bug-reports`);
      if (!res.ok) throw new Error('Failed to load bug reports');
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReports(); loadInbox(); }, []);

  async function loadInbox() {
    setInboxLoading(true);
    setInboxError('');
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/inbox/threads`);
      if (!res.ok) throw new Error('Failed to load inbox');
      const data = await res.json();
      setInbox(Array.isArray(data) ? data : []);
    } catch (err) {
      setInboxError(err.message);
    } finally {
      setInboxLoading(false);
    }
  }

  async function loadThread(conversationId) {
    setThreadLoading(true);
    setThreadMessages([]);
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/inbox/threads/${conversationId}`);
      if (!res.ok) throw new Error('Failed to load thread');
      const data = await res.json();
      setThreadMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setThreadLoading(false);
    }
  }

  async function updateStatus(id, status, note = '') {
    setUpdating(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/bug-reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, resolvedNote: note }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const updated = await res.json();
      setReports(prev => prev.map(r => r._id === id ? updated : r));
      setSelected(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  }

  const filtered = reports.filter(r => {
    if (tab !== 'all' && r.status !== tab) return false;
    if (sevFilter && r.severity !== sevFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.page?.toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleTabChange(id) { setTab(id); setPage(1); }

  const tabs = [
    { id: 'all',         label: 'All',         count: reports.length },
    { id: 'open',        label: 'Open',        count: reports.filter(r => r.status === 'open').length },
    { id: 'in_progress', label: 'In Progress', count: reports.filter(r => r.status === 'in_progress').length },
    { id: 'sent',        label: 'Sent',        count: reports.filter(r => r.status === 'sent').length },
    { id: 'resolved',    label: 'Resolved',    count: reports.filter(r => r.status === 'resolved').length },
  ];

  // Tab scroll indicators
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
  }, [tabs.length]);

  // Export CSV
  const [exportLoading, setExportLoading] = useState(false);
  function handleExport() {
    setExportLoading(true);
    const rows = [['Severity','Reporter','Email','Page','Description','Status','Date'],
      ...filtered.map(r => [r.severity, r.name, r.email, r.page, (r.description || '').replace(/<[^>]*>/g, ''), r.status, new Date(r.createdAt).toLocaleString()])];
    const csv = rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'bug-reports.csv'; link.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setExportLoading(false), 600);
  }

  // Severity filter dropdown
  const [showSevDrop, setShowSevDrop] = useState(false);
  const sevRef = useRef(null);
  useEffect(() => {
    function handler(e) { if (sevRef.current && !sevRef.current.contains(e.target)) setShowSevDrop(false); }
    if (showSevDrop) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSevDrop]);

  return (
    <div className="db-layout">
      <Sidebar />
      <div className="db-main">
        <TopBar />
        <div className="cl-content">
          <style>{`
            @keyframes br-enter { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
            .br-row:hover { background: ${dark ? '#0d2619' : '#f8fffe'} !important; }
            .br-tab-scroll::-webkit-scrollbar { display: none; }
            .br-export-btn {
              display: inline-flex; align-items: center; gap: 7px;
              padding: 8px 16px; border-radius: 9px; border: none;
              font-size: 0.82rem; font-weight: 600; white-space: nowrap;
              transition: background 0.15s; cursor: pointer;
            }
            .br-export-label { display: inline; }
            @media (max-width: 768px) {
              .br-filter-bar { gap: 8px !important; }
              .br-filter-bar .br-filter-search { width: 100% !important; min-width: 0 !important; flex: unset !important; }
              .br-filter-bar select { flex: 1; min-width: 0; }
              .br-export-btn { width: 38px; height: 38px; padding: 0; justify-content: center; border-radius: 12px; }
              .br-export-label { display: none; }
            }
          `}</style>

          {/* Header */}
          <header className="cl-content__header" style={{ marginBottom: 16 }}>
            <div>
              <h1 className="cl-content__title">Bug Reports</h1>
              <p className="cl-content__sub">Review bug reports submitted by clients</p>
            </div>
            <button onClick={handleExport} disabled={exportLoading} className="br-export-btn"
              style={{
                background: exportLoading ? (dark ? '#0d2619' : '#e0e0e0') : '#1a9e6e',
                color: exportLoading ? (dark ? '#4d8a6a' : '#aaa') : '#fff',
                cursor: exportLoading ? 'not-allowed' : 'pointer',
                boxShadow: exportLoading ? 'none' : '0 2px 8px rgba(26,158,110,0.20)',
              }}
              title="Export CSV"
            >
              {exportLoading
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ animation: 'br-enter 0.8s linear infinite' }}><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                : <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 16h14" strokeLinecap="round"/></svg>
              }
              <span className="br-export-label">{exportLoading ? 'Exporting…' : 'Export CSV'}</span>
            </button>
          </header>

          {/* Tab bar + card wrapper */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Tabs */}
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
              <div className="br-tab-scroll" ref={tabScrollRef} onScroll={handleTabScroll} style={{ display: 'flex', alignItems: 'flex-end', background: 'transparent', marginBottom: '-1px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                {tabs.map(t => {
                  const active = tab === t.id;
                  return (
                    <button key={t.id} onClick={() => handleTabChange(t.id)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '9px 18px 10px', border: '1px solid',
                      borderColor: active ? border : 'transparent',
                      borderBottom: active ? `1px solid ${surface}` : 'none',
                      borderRadius: '10px 10px 0 0',
                      background: active ? surface : 'transparent',
                      marginBottom: '-1px', cursor: 'pointer', whiteSpace: 'nowrap',
                      fontSize: '0.82rem', fontWeight: 600,
                      color: active ? (dark ? '#26c47a' : '#10b981') : (dark ? '#4d8a6a' : '#9ca3af'),
                      transition: 'color 0.15s', position: 'relative', zIndex: active ? 2 : 0,
                    }}>
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

            {/* Card */}
            <div style={{ background: surface, borderRadius: tab === 'all' ? '0 12px 12px 12px' : '12px 12px 12px 12px', border: `1px solid ${border}`, overflow: 'hidden', boxShadow: dark ? '0 2px 12px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.06)' }}>

              {/* Filter bar */}
              <div className="br-filter-bar" style={{ padding: '14px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div className="br-filter-search" style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke={textMuted} strokeWidth="2" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5" strokeLinecap="round"/>
                  </svg>
                  <input type="text" placeholder="Search reports…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 32px', borderRadius: 9, border: `1px solid ${border}`, background: inputBg, color: textMain, fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit' }}
                  />
                </div>
                {/* Severity dropdown */}
                <div ref={sevRef} style={{ position: 'relative', flexShrink: 0 }}>
                  <div onClick={() => setShowSevDrop(v => !v)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px 7px 12px', borderRadius: 8,
                    border: `1px solid ${border}`, background: inputBg, cursor: 'pointer', fontSize: '0.82rem',
                    color: sevFilter ? '#059669' : textMuted, fontWeight: sevFilter ? 600 : 500, userSelect: 'none', whiteSpace: 'nowrap',
                  }}>
                    <span>{sevFilter ? SEV_META[sevFilter]?.label : 'All Severities'}</span>
                    <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {showSevDrop && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 300, background: surface, border: `1.5px solid ${border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 160, overflow: 'hidden' }}>
                      {[{ value: '', label: 'All Severities' }, ...Object.entries(SEV_META).map(([k, v]) => ({ value: k, label: v.label }))].map(opt => (
                        <div key={opt.value} onClick={() => { setSevFilter(opt.value); setPage(1); setShowSevDrop(false); }} style={{
                          padding: '9px 14px', cursor: 'pointer', fontSize: '0.85rem',
                          background: sevFilter === opt.value ? (dark ? '#0d2619' : '#f0fdf4') : 'transparent',
                          color: sevFilter === opt.value ? '#059669' : (dark ? '#7ab89a' : '#374151'),
                          fontWeight: sevFilter === opt.value ? 600 : 400,
                          borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f7f7f7'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                          onMouseEnter={e => { if (sevFilter !== opt.value) e.currentTarget.style.background = dark ? '#132a1e' : '#f8faf9'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = sevFilter === opt.value ? (dark ? '#0d2619' : '#f0fdf4') : 'transparent'; }}
                        >
                          {opt.label}
                          {sevFilter === opt.value && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: textMuted, whiteSpace: 'nowrap' }}>
                  {filtered.length} report{filtered.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Table */}
              {loading ? (
                <div style={{ padding: 48, textAlign: 'center', color: textMuted, fontSize: '0.875rem' }}>Loading bug reports…</div>
              ) : error ? (
                <div style={{ padding: 48, textAlign: 'center', color: '#ef4444', fontSize: '0.875rem' }}>{error}</div>
              ) : paginated.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: textMuted, fontSize: '0.875rem' }}>
                  {reports.length === 0 ? 'No bug reports yet.' : 'No reports match your filters.'}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: dark ? '#0f2417' : '#f9fafb', borderBottom: `1px solid ${border}` }}>
                        {['Severity', 'Reporter', 'Page/Module', 'Description', 'Status', 'Time', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: textMuted, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((r, i) => {
                        const sev = SEV_META[r.severity] || SEV_META.medium;
                        const st  = STATUS_META[r.status] || STATUS_META.open;
                        return (
                          <tr key={r._id} className="br-row" onClick={() => setSelected(r)} style={{
                            borderBottom: `1px solid ${border}`, cursor: 'pointer',
                            animation: `br-enter 0.15s ease ${i * 0.03}s both`,
                          }}>
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
                                color: dark ? sev.darkColor : sev.color, background: dark ? sev.darkBg : sev.bg,
                              }}>{sev.label}</span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(displayName(r)), color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {getInitials(displayName(r))}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, color: textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{displayName(r)}</div>
                                  <div style={{ fontSize: '0.72rem', color: textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{r.email}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', color: textMain, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.page || '—'}</td>
                            <td style={{ padding: '12px 16px', color: textMuted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(r.description || '').replace(/<[^>]*>/g, '')}</td>
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
                                color: dark ? st.darkColor : st.color, background: dark ? st.darkBg : st.bg,
                              }}>{st.label}</span>
                            </td>
                            <td style={{ padding: '12px 16px', color: textMuted, whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{timeAgo(r.createdAt)}</td>
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                              {(r.status === 'open' || r.status === 'in_progress') && r.status !== 'sent' && (
                                <div style={{ display: 'flex', gap: 5 }}>
                                  <button onClick={() => updateStatus(r._id, 'in_progress')} disabled={updating} style={{
                                    padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: '0.72rem', fontWeight: 600,
                                    background: dark ? '#052e16' : '#d1fae5', color: dark ? '#4ade80' : '#059669',
                                    cursor: updating ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                                  }}>Approve</button>
                                  <button onClick={() => { setDeclineTarget(r); setDeclineReason(''); }} disabled={updating} style={{
                                    padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: '0.72rem', fontWeight: 600,
                                    background: dark ? '#2a0d0d' : '#fee2e2', color: dark ? '#f87171' : '#dc2626',
                                    cursor: updating ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                                  }}>Reject</button>
                                </div>
                              )}
                              {r.status === 'sent' && <span style={{ fontSize: '0.72rem', color: dark ? '#60a5fa' : '#2563eb', fontWeight: 600 }}>Sent</span>}
                              {r.status === 'resolved' && <span style={{ fontSize: '0.72rem', color: dark ? '#4ade80' : '#059669', fontWeight: 600 }}>Resolved</span>}
                              {r.status === 'dismissed' && <span style={{ fontSize: '0.72rem', color: dark ? '#f87171' : '#dc2626', fontWeight: 600 }}>Rejected</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: `1px solid ${border}` }}>
                  <span style={{ fontSize: '0.75rem', color: dark ? '#4d8a6a' : '#9ca3af' }}>Page {page} of {totalPages} · {filtered.length} report{filtered.length !== 1 ? 's' : ''}</span>
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
          </div>

          {/* ── Detail Modal ── */}
          {selected && (
            <div onClick={() => { setSelected(null); setReplyText(''); setReplySent(false); }} style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}>
              <div onClick={e => e.stopPropagation()} style={{
                background: surface, borderRadius: 16, border: `1px solid ${border}`,
                width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)', animation: 'br-enter 0.2s ease',
              }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>🐛</span>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: textMain, margin: 0 }}>Bug Report Detail</h2>
                  </div>
                  <button onClick={() => { setSelected(null); setReplyText(''); setReplySent(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, fontSize: 18, padding: 4 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 24px' }}>
                  {/* Severity + Status */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    {(() => { const s = SEV_META[selected.severity] || SEV_META.medium; return (
                      <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: dark ? s.darkColor : s.color, background: dark ? s.darkBg : s.bg }}>{s.label}</span>
                    ); })()}
                    {(() => { const s = STATUS_META[selected.status] || STATUS_META.open; return (
                      <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: dark ? s.darkColor : s.color, background: dark ? s.darkBg : s.bg }}>{s.label}</span>
                    ); })()}
                  </div>

                  {/* Fields */}
                  {[
                    ['Date/Time', new Date(selected.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })],
                    ['Reported By', `${selected.name || '—'} (${selected.email})`],
                    ['Page/Module', selected.page || '—'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 13, color: textMain }}>{value}</div>
                    </div>
                  ))}

                  <hr style={{ border: 'none', borderTop: `1px solid ${border}`, margin: '16px 0' }} />

                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Bug Description</div>
                    <div style={{ fontSize: 13, color: textMain, lineHeight: 1.65, background: inputBg, border: `1px solid ${border}`, borderRadius: 10, padding: '14px 16px' }}
                      dangerouslySetInnerHTML={{ __html: selected.description }}
                    />
                  </div>

                  {/* Attached screenshots */}
                  {selected.images?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Attachments ({selected.images.length})</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {selected.images.map((img, i) => (
                          <a key={i} href={img.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: 100, height: 100, borderRadius: 8, overflow: 'hidden', border: `1px solid ${border}`, flexShrink: 0 }}>
                            <img src={img.url} alt={`Attachment ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {(selected.status === 'open' || selected.status === 'in_progress') && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        onClick={() => { setEmailPreview(selected); setSendSuccess(false); }}
                        disabled={updating}
                        style={{
                          flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
                          background: dark ? '#052e16' : '#d1fae5', color: dark ? '#4ade80' : '#059669',
                          fontSize: 13, fontWeight: 600, cursor: updating ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Approve
                      </button>
                      <button
                        onClick={() => { setDeclineTarget(selected); setDeclineReason(''); }}
                        disabled={updating}
                        style={{
                          flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
                          background: dark ? '#2a0d0d' : '#fee2e2', color: dark ? '#f87171' : '#dc2626',
                          fontSize: 13, fontWeight: 600, cursor: updating ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        Reject
                      </button>
                    </div>
                  )}

                  {/* ── Admin Replies ── */}
                  <hr style={{ border: 'none', borderTop: `1px solid ${border}`, margin: '20px 0 14px' }} />

                  {selected.adminReplies?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Admin Replies</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selected.adminReplies.map((reply, i) => (
                          <div key={i} style={{ padding: '10px 14px', borderRadius: 10, background: inputBg, border: `1px solid ${border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: dark ? '#4ade80' : '#059669' }}>{reply.sentByName}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {reply.emailedToClient && (
                                  <span style={{ fontSize: 10, color: dark ? '#60a5fa' : '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    Emailed
                                  </span>
                                )}
                                <span style={{ fontSize: 11, color: textMuted }}>
                                  {new Date(reply.sentAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                </span>
                              </div>
                            </div>
                            <div style={{ fontSize: 13, color: textMain, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{reply.message}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reply form */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Reply to Client</div>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Type your response to the client…"
                    rows={3}
                    maxLength={2000}
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10,
                      border: `1.5px solid ${border}`, fontSize: 13, color: textMain,
                      background: inputBg, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
                    }}
                    onFocus={e => { e.target.style.borderColor = '#1a9e6e'; }}
                    onBlur={e => { e.target.style.borderColor = border; }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: textMuted }}>{replyText.length}/2000</span>
                    <button
                      onClick={async () => {
                        if (!replyText.trim()) return;
                        setSendingReply(true);
                        try {
                          const res = await fetchWithAuth(`${API_BASE}/api/bug-reports/${selected._id}/reply`, {
                            method: 'POST',
                            body: JSON.stringify({ message: replyText.trim() }),
                          });
                          if (res.ok) {
                            const updated = await res.json();
                            setReports(prev => prev.map(r => r._id === updated._id ? updated : r));
                            setSelected(updated);
                            setReplyText('');
                            setReplySent(true);
                            setTimeout(() => setReplySent(false), 2000);
                          }
                        } catch (err) { console.error(err); } finally { setSendingReply(false); }
                      }}
                      disabled={sendingReply || !replyText.trim()}
                      style={{
                        padding: '8px 18px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 600,
                        background: replySent ? '#059669' : (!replyText.trim() ? (dark ? '#1e3a2a' : '#e5e7eb') : 'linear-gradient(135deg, #1a9e6e, #059669)'),
                        color: !replyText.trim() ? (dark ? '#4d8a6a' : '#9ca3af') : '#fff',
                        cursor: sendingReply || !replyText.trim() ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s',
                      }}
                    >
                      {replySent
                        ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg> Sent!</>
                        : sendingReply ? 'Sending…'
                        : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg> Send Reply</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Decline Reason Modal ── */}
          {declineTarget && (
            <div onClick={() => setDeclineTarget(null)} style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10001,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}>
              <div onClick={e => e.stopPropagation()} style={{
                background: surface, borderRadius: 16, border: `1px solid ${border}`,
                width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                animation: 'br-enter 0.2s ease', padding: '24px',
              }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: textMain, margin: '0 0 6px' }}>Reject Bug Report</h3>
                <p style={{ fontSize: 12, color: textMuted, margin: '0 0 16px', lineHeight: 1.5 }}>
                  Explain why this report is being rejected. The client will see this reason.
                </p>

                <textarea
                  autoFocus
                  value={declineReason}
                  onChange={e => setDeclineReason(e.target.value)}
                  placeholder="e.g. This is expected behavior, not a bug…"
                  rows={3}
                  maxLength={500}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10,
                    border: `1.5px solid ${border}`, fontSize: 13, color: textMain,
                    background: inputBg, outline: 'none', resize: 'vertical',
                    fontFamily: 'inherit', lineHeight: 1.5,
                  }}
                  onFocus={e => { e.target.style.borderColor = '#ef4444'; }}
                  onBlur={e => { e.target.style.borderColor = border; }}
                />
                <div style={{ fontSize: 11, color: textMuted, textAlign: 'right', marginTop: 4 }}>{declineReason.length}/500</div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={() => setDeclineTarget(null)} disabled={updating} style={{
                    flex: 1, padding: '10px 16px', borderRadius: 10,
                    border: `1px solid ${border}`, background: 'transparent',
                    color: textMain, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Cancel</button>
                  <button
                    onClick={async () => {
                      await updateStatus(declineTarget._id, 'dismissed', declineReason.trim());
                      setDeclineTarget(null);
                      setDeclineReason('');
                    }}
                    disabled={updating || !declineReason.trim()}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
                      background: !declineReason.trim() ? (dark ? '#1e3a2a' : '#e5e7eb') : '#ef4444',
                      color: !declineReason.trim() ? (dark ? '#4d8a6a' : '#9ca3af') : '#fff',
                      fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                      cursor: !declineReason.trim() || updating ? 'not-allowed' : 'pointer',
                    }}
                  >{updating ? 'Rejecting…' : 'Reject Report'}</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Email Preview Modal ── */}
          {emailPreview && (() => {
            const r = emailPreview;
            const sevColors = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };
            const sl = (r.severity || 'high').charAt(0).toUpperCase() + (r.severity || 'high').slice(1);
            const dt = new Date(r.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
            return (
              <div onClick={() => !sending && setEmailPreview(null)} style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10002,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              }}>
                <div onClick={e => e.stopPropagation()} style={{
                  background: dark ? '#132a1e' : '#fff', borderRadius: 16, border: `1px solid ${border}`,
                  width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                }}>
                  {/* Preview header */}
                  <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      <span style={{ fontSize: 14, fontWeight: 700, color: textMain }}>Email Preview</span>
                    </div>
                    <button onClick={() => !sending && setEmailPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, fontSize: 18, padding: 4 }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    </button>
                  </div>

                  {/* To field */}
                  <div style={{ padding: '10px 20px', borderBottom: `1px solid ${border}`, fontSize: 12, color: textMuted }}>
                    <strong>To:</strong> <span style={{ color: textMain }}>innovation@telexph.com</span>
                  </div>
                  <div style={{ padding: '10px 20px', borderBottom: `1px solid ${border}`, fontSize: 12, color: textMuted }}>
                    <strong>Subject:</strong> <span style={{ color: textMain }}>[BUG REPORT] [{sl.toUpperCase()}] [HostOps]</span>
                  </div>

                  {/* Email body preview */}
                  <div style={{ padding: 20 }}>
                    <div style={{ background: dark ? '#0c1c14' : '#fafafa', border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden' }}>
                      {/* Email header bar */}
                      <div style={{ background: '#0c1c14', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#26a676', fontSize: 14, fontWeight: 700 }}>HostOps Bug Report</span>
                        <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, color: '#fff', background: sevColors[r.severity] || '#f97316' }}>{sl}</span>
                      </div>

                      {/* Email content */}
                      <div style={{ padding: '20px', background: '#fff', color: '#111827', fontSize: 13, lineHeight: 1.6 }}>
                        <p style={{ margin: '0 0 16px' }}>Good day,</p>
                        <p style={{ margin: '0 0 16px' }}>Please see the bug report details below.</p>

                        <hr style={{ border: 'none', borderTop: '1.5px solid #e5e7eb', margin: '0 0 16px' }} />

                        <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Date/Time Discovered:</p>
                        <p style={{ margin: '0 0 14px', fontSize: 13 }}>{dt}</p>

                        <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Reported By:</p>
                        <p style={{ margin: '0 0 14px', fontSize: 13 }}>{r.name || '—'} &lt;{r.email}&gt;</p>

                        <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Page/Module Affected:</p>
                        <p style={{ margin: '0 0 14px', fontSize: 13 }}>{r.page || '—'}</p>

                        <hr style={{ border: 'none', borderTop: '1.5px solid #e5e7eb', margin: '0 0 16px' }} />

                        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: 0.5 }}><em>Bug Description:</em></p>
                        <div style={{ fontSize: 13, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: r.description }} />

                        {r.images?.length > 0 && (
                          <>
                            <hr style={{ border: 'none', borderTop: '1.5px solid #e5e7eb', margin: '16px 0' }} />
                            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Attachments:</p>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {r.images.map((img, i) => (
                                <img key={i} src={img.url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                              ))}
                            </div>
                          </>
                        )}

                        <hr style={{ border: 'none', borderTop: '1.5px solid #e5e7eb', margin: '16px 0 10px' }} />
                        <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Report ID: <code style={{ fontSize: 10 }}>{r._id}</code></span>
                          <span>Submitted via HostOps Client Dashboard</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ padding: '0 20px 20px', display: 'flex', gap: 8 }}>
                    <button onClick={() => setEmailPreview(null)} disabled={sending} style={{
                      flex: 1, padding: '10px 16px', borderRadius: 10,
                      border: `1px solid ${border}`, background: 'transparent',
                      color: textMain, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>Cancel</button>
                    <button
                      onClick={async () => {
                        setSending(true); setSendSuccess(false);
                        try {
                          const res = await fetchWithAuth(`${API_BASE}/api/bug-reports/${r._id}/send-email`, { method: 'POST' });
                          if (res.ok) {
                            await updateStatus(r._id, 'sent');
                            setSendSuccess(true);
                            setTimeout(() => { setEmailPreview(null); setSendSuccess(false); }, 1500);
                          }
                        } catch {} finally { setSending(false); }
                      }}
                      disabled={sending || sendSuccess}
                      style={{
                        flex: 2, padding: '10px 16px', borderRadius: 10, border: 'none',
                        background: sendSuccess ? '#059669' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                        cursor: sending || sendSuccess ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      {sendSuccess ? (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg> Sent!</>) :
                       sending ? 'Sending…' : (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg> Confirm & Send</>)}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Email Inbox Section ── */}
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textMain} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: textMain, margin: 0 }}>Email Inbox</h2>
                <span style={{ fontSize: 11, color: textMuted, fontWeight: 500 }}>innovation@telexph.com</span>
              </div>
              <button onClick={loadInbox} disabled={inboxLoading} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8, border: `1px solid ${border}`,
                background: 'transparent', color: textMuted, fontSize: 12, fontWeight: 600,
                cursor: inboxLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ animation: inboxLoading ? 'br-spin 0.8s linear infinite' : 'none' }}>
                  <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round"/>
                </svg>
                {inboxLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>

            <style>{`@keyframes br-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>


            <div style={{ background: surface, borderRadius: 12, border: `1px solid ${border}`, overflow: 'hidden', boxShadow: dark ? '0 2px 12px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.06)' }}>
              {inboxLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: textMuted, fontSize: 13 }}>Loading threads…</div>
              ) : inboxError ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontSize: 13 }}>{inboxError}</div>
              ) : inbox.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: textMuted, fontSize: 13 }}>No bug report emails found.</div>
              ) : (
                inbox.map((thread, i) => {
                  const date = new Date(thread.latestDate).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
                  const subjectClean = thread.subject.replace(/\[BUG REPORT\]\s*/, '').trim();
                  return (
                    <div key={thread.conversationId} className="br-row"
                      onClick={() => { setSelectedThread(thread); loadThread(thread.conversationId); }}
                      style={{ padding: '14px 20px', borderBottom: i < inbox.length - 1 ? `1px solid ${border}` : 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ marginTop: 4, flexShrink: 0 }}>
                        {thread.hasUnread
                          ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />
                          : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'transparent', border: `1.5px solid ${border}` }} />
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                          <div style={{ fontWeight: thread.hasUnread ? 700 : 600, color: textMain, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subjectClean}</div>
                          <div style={{ fontSize: 11, color: textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>{date}</div>
                        </div>
                        <div style={{ fontSize: 12, color: textMuted, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600, color: dark ? '#7ab89a' : '#374151' }}>{thread.from}</span>
                          {thread.messageCount > 1 && <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 20, background: dark ? '#0d2619' : '#f0fdf4', color: dark ? '#4ade80' : '#059669', fontSize: 10, fontWeight: 700 }}>{thread.messageCount}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.preview}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Thread Detail Modal ── */}
          {selectedThread && (
            <div onClick={() => { setSelectedThread(null); setThreadMessages([]); }} style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10003,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}>
              <div onClick={e => e.stopPropagation()} style={{
                background: surface, borderRadius: 16, border: `1px solid ${border}`,
                width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)', animation: 'br-enter 0.2s ease',
              }}>
                <div style={{ padding: '18px 24px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: textMain, marginBottom: 4 }}>{selectedThread.subject}</div>
                    <div style={{ fontSize: 11, color: textMuted }}>{selectedThread.messageCount} message{selectedThread.messageCount !== 1 ? 's' : ''}</div>
                  </div>
                  <button onClick={() => { setSelectedThread(null); setThreadMessages([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, padding: 4, flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </button>
                </div>
                <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {threadLoading ? (
                    <div style={{ padding: 32, textAlign: 'center', color: textMuted, fontSize: 13 }}>Loading messages…</div>
                  ) : threadMessages.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: textMuted, fontSize: 13 }}>No messages found.</div>
                  ) : (
                    threadMessages.map((msg) => {
                      const from     = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || '—';
                      const addr     = msg.from?.emailAddress?.address || '';
                      const dt       = new Date(msg.receivedDateTime).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
                      const isAdmin  = addr.toLowerCase() === 'innovation@telexph.com';
                      return (
                        <div key={msg.id} style={{ borderRadius: 12, border: `1px solid ${border}`, overflow: 'hidden' }}>
                          <div style={{ padding: '10px 16px', background: dark ? '#0f2417' : '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: isAdmin ? '#1a9e6e' : '#2563eb', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {from.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: textMain }}>{from}</div>
                                <div style={{ fontSize: 11, color: textMuted }}>{addr}</div>
                              </div>
                            </div>
                            <div style={{ fontSize: 11, color: textMuted, whiteSpace: 'nowrap' }}>{dt}</div>
                          </div>
                          <div style={{ padding: '14px 16px', background: surface, fontSize: 13, color: textMain, lineHeight: 1.65, maxHeight: 320, overflowY: 'auto' }}
                            dangerouslySetInnerHTML={{ __html: msg.body?.content || '' }}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
