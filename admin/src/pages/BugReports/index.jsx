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
      setReports(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReports(); }, []);

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
    { id: 'resolved',    label: 'Resolved',    count: reports.filter(r => r.status === 'resolved').length },
  ];

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
            @media (max-width: 768px) {
              .br-filter-bar { gap: 8px !important; }
              .br-filter-bar .br-filter-search { width: 100% !important; min-width: 0 !important; flex: unset !important; }
              .br-filter-bar select { flex: 1; min-width: 0; }
            }
          `}</style>

          {/* Header */}
          <header className="cl-content__header" style={{ marginBottom: 16 }}>
            <div>
              <h1 className="cl-content__title">Bug Reports</h1>
              <p className="cl-content__sub">Review bug reports submitted by clients</p>
            </div>
          </header>

          {/* Tab bar + card wrapper */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Tabs */}
            <div style={{ position: 'sticky', top: 0, zIndex: 100, overflow: 'visible', background: dark ? '#0c1c14' : 'var(--color-bg, #f2f4f7)' }}>
              <div className="br-tab-scroll" style={{ display: 'flex', alignItems: 'flex-end', background: 'transparent', marginBottom: '-1px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                {tabs.map(t => {
                  const active = tab === t.id;
                  return (
                    <button key={t.id} onClick={() => handleTabChange(t.id)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '9px 18px 10px', border: '1px solid',
                      borderColor: active ? (dark ? '#1e3a2a' : '#e8ecf0') : 'transparent',
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
            <div style={{ background: surface, borderRadius: '0 12px 12px 12px', border: `1px solid ${border}`, overflow: 'hidden', boxShadow: dark ? '0 2px 12px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.06)' }}>

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
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(r.name || r.email), color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {getInitials(r.name || r.email)}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, color: textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{r.name || '—'}</div>
                                  <div style={{ fontSize: '0.72rem', color: textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{r.email}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', color: textMain, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.page || '—'}</td>
                            <td style={{ padding: '12px 16px', color: textMuted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</td>
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
                                color: dark ? st.darkColor : st.color, background: dark ? st.darkBg : st.bg,
                              }}>{st.label}</span>
                            </td>
                            <td style={{ padding: '12px 16px', color: textMuted, whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{timeAgo(r.createdAt)}</td>
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                              {(r.status === 'open' || r.status === 'in_progress') && (
                                <div style={{ display: 'flex', gap: 5 }}>
                                  <button onClick={() => updateStatus(r._id, 'resolved')} disabled={updating} style={{
                                    padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: '0.72rem', fontWeight: 600,
                                    background: dark ? '#052e16' : '#d1fae5', color: dark ? '#4ade80' : '#059669',
                                    cursor: updating ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                                  }}>Approve</button>
                                  <button onClick={() => { setDeclineTarget(r); setDeclineReason(''); }} disabled={updating} style={{
                                    padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: '0.72rem', fontWeight: 600,
                                    background: dark ? '#2a0d0d' : '#fee2e2', color: dark ? '#f87171' : '#dc2626',
                                    cursor: updating ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                                  }}>Decline</button>
                                </div>
                              )}
                              {r.status === 'resolved' && <span style={{ fontSize: '0.72rem', color: dark ? '#4ade80' : '#059669', fontWeight: 600 }}>Approved</span>}
                              {r.status === 'dismissed' && <span style={{ fontSize: '0.72rem', color: dark ? '#f87171' : '#dc2626', fontWeight: 600 }}>Declined</span>}
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
            <div onClick={() => setSelected(null)} style={{
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
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, fontSize: 18, padding: 4 }}>
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
                    <div style={{ fontSize: 13, color: textMain, lineHeight: 1.65, whiteSpace: 'pre-wrap', background: inputBg, border: `1px solid ${border}`, borderRadius: 10, padding: '14px 16px' }}>
                      {selected.description}
                    </div>
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

                  {/* Status actions */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Update Status</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(STATUS_META).map(([key, meta]) => {
                      const active = selected.status === key;
                      return (
                        <button key={key} onClick={() => {
                          if (active) return;
                          if (key === 'dismissed') { setDeclineTarget(selected); setDeclineReason(''); }
                          else updateStatus(selected._id, key);
                        }} disabled={active || updating}
                          style={{
                            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                            border: `1.5px solid ${active ? (dark ? meta.darkColor : meta.color) : border}`,
                            background: active ? (dark ? meta.darkBg : meta.bg) : 'transparent',
                            color: active ? (dark ? meta.darkColor : meta.color) : textMuted,
                            cursor: active || updating ? 'default' : 'pointer', transition: 'all 0.15s',
                            opacity: updating && !active ? 0.5 : 1,
                          }}
                        >{meta.label}</button>
                      );
                    })}
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
                <h3 style={{ fontSize: 15, fontWeight: 700, color: textMain, margin: '0 0 6px' }}>Decline Bug Report</h3>
                <p style={{ fontSize: 12, color: textMuted, margin: '0 0 16px', lineHeight: 1.5 }}>
                  Explain why this report is being declined. The client will see this reason.
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
                  >{updating ? 'Declining…' : 'Decline Report'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
