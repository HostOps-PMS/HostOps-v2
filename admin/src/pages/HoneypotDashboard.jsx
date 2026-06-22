import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../AuthContext';
import Sidebar from './Sidebar';
import TopBar from './dashboard/components/TopBar';
import { useTheme } from '../context/ThemeContext';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/internal/ops` : '/internal/ops';

const SEV_META = {
  critical:   { label: 'Critical',   color: '#ef4444', bg: '#fef2f2', darkColor: '#f87171', darkBg: '#2a0d0d' },
  suspicious: { label: 'Suspicious', color: '#d97706', bg: '#fffbeb', darkColor: '#fbbf24', darkBg: '#2a1f0a' },
  info:       { label: 'Info',       color: '#2563eb', bg: '#eff6ff', darkColor: '#60a5fa', darkBg: '#0d1a2a' },
};

export default function HoneypotDashboard() {
  const { dark } = useTheme();
  const { getToken, fetchWithAuth } = useAuth();
  const adminToken = getToken();

  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ severity: '', ip: '', fingerprint: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  const surface  = dark ? '#132a1e' : '#fff';
  const border   = dark ? '#1e3a2a' : '#e5e7eb';
  const textMain = dark ? '#eaf5f0' : '#111827';
  const textMuted = dark ? '#7ab89a' : '#6b7280';
  const inputBg  = dark ? '#0d2619' : '#f9fafb';

  useEffect(() => {
    if (!adminToken) return;
    fetchWithAuth(`${API_BASE}/stats`).then(r => r.json()).then(setStats).catch(() => {});
  }, [adminToken]);

  useEffect(() => {
    if (!adminToken) return;
    setLoading(true);
    const params = new URLSearchParams({ page, limit: pageSize });
    if (filters.severity) params.set('severity', filters.severity);
    if (filters.ip) params.set('ip', filters.ip);
    if (filters.fingerprint) params.set('fingerprint', filters.fingerprint);
    fetchWithAuth(`${API_BASE}/logs?${params}`)
      .then(r => r.json())
      .then(data => { setLogs(data.logs || []); setTotalPages(data.totalPages || 1); setError(''); })
      .catch(() => setError('Failed to load logs'))
      .finally(() => setLoading(false));
  }, [page, pageSize, filters, adminToken]);

  async function downloadFile(endpoint, filename) {
    setExportLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/${endpoint}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
    finally { setExportLoading(false); }
  }

  // Severity dropdown
  const [showSevDrop, setShowSevDrop] = useState(false);
  const sevRef = useRef(null);
  useEffect(() => {
    function h(e) { if (sevRef.current && !sevRef.current.contains(e.target)) setShowSevDrop(false); }
    if (showSevDrop) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showSevDrop]);

  return (
    <div className="db-layout">
      <Sidebar />
      <div className="db-main">
        <TopBar />
        <div className="cl-content">
          <style>{`
            .hp-row:hover { background: ${dark ? '#0d2619' : '#f8fffe'} !important; }
            @media (max-width: 768px) {
              .hp-filter-bar { gap: 8px !important; flex-direction: column !important; align-items: stretch !important; }
              .hp-filter-bar .hp-filter-search { width: 100% !important; min-width: 0 !important; flex: unset !important; }
              .hp-filter-bar .hp-stats-row { width: 100% !important; margin-right: 0 !important; }
              .hp-filter-bar .hp-stats-row > span { flex: 1 !important; justify-content: center !important; }
              .hp-stat-label { display: none !important; }
              .hp-filter-bar .hp-sev-wrap { width: 100% !important; }
              .hp-filter-bar .hp-sev-wrap > div:first-child { width: 100% !important; justify-content: space-between !important; }
            }
            .hp-export-btn { display: inline-flex; align-items: center; gap: 7px; padding: 8px 16px; border-radius: 9px; border: none; font-size: 0.82rem; font-weight: 600; white-space: nowrap; cursor: pointer; transition: background 0.15s; }
            .hp-export-label { display: inline; }
            @media (max-width: 768px) {
              .hp-export-btn { width: 38px; height: 38px; padding: 0; justify-content: center; border-radius: 12px; }
              .hp-export-label { display: none; }
              .hp-pagination { flex-direction: column; align-items: center; }
              .hp-pagination > div { justify-content: center; }
            }
          `}</style>

          {/* Header */}
          <header className="cl-content__header" style={{ marginBottom: 16 }}>
            <div>
              <h1 className="cl-content__title">Honeypot Security</h1>
              <p className="cl-content__sub">Threat monitoring and deception telemetry</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => downloadFile('download/events', 'honeypot-events.csv')} className="hp-export-btn"
                style={{ background: dark ? '#0d2619' : '#fff', color: dark ? '#7ab89a' : '#374151', border: `1px solid ${border}` }} title="Export Events CSV">
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 16h14" strokeLinecap="round"/></svg>
                <span className="hp-export-label">Events CSV</span>
              </button>
              <button onClick={() => downloadFile('download/blocklist', 'honeypot-blocklist.csv')} className="hp-export-btn"
                style={{ background: '#ef4444', color: '#fff' }} title="Export Blocklist CSV">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round"/></svg>
                <span className="hp-export-label">Blocklist CSV</span>
              </button>
            </div>
          </header>

          {/* Card */}
          <div style={{ background: surface, borderRadius: 12, border: `1px solid ${border}`, overflow: 'visible', boxShadow: dark ? '0 2px 12px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.06)' }}>

            {/* Filter bar */}
            <div className="hp-filter-bar" style={{ padding: '14px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Stats as filter pills */}
              {stats && (
                <div className="hp-stats-row" style={{ display: 'flex', gap: 6, marginRight: 'auto', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Events 24h', value: stats.last24h, color: '#2563eb', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
                    { label: 'Critical 24h', value: stats.criticalLast24h, color: '#ef4444', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
                    { label: 'Banned', value: stats.bannedTotal, color: '#8b5cf6', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
                  ].map(s => (
                    <span key={s.label} title={`${s.label}: ${s.value ?? 0}`} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
                      background: dark ? `${s.color}15` : `${s.color}10`, color: s.color,
                      border: `1px solid ${s.color}30`, cursor: 'default',
                    }}>
                      <svg className="hp-stat-icon" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d={s.icon}/></svg>
                      <span className="hp-stat-label">{s.label}: </span>
                      <strong>{s.value ?? 0}</strong>
                    </span>
                  ))}
                </div>
              )}

              {/* Search IP */}
              <div className="hp-filter-search" style={{ position: 'relative', flex: 1, minWidth: 140 }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke={textMuted} strokeWidth="2" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5" strokeLinecap="round"/>
                </svg>
                <input type="text" placeholder="Filter by IP…" value={filters.ip}
                  onChange={e => { setFilters(f => ({ ...f, ip: e.target.value })); setPage(1); }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 32px', borderRadius: 9, border: `1px solid ${border}`, background: inputBg, color: textMain, fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>

              {/* Severity dropdown */}
              <div ref={sevRef} className="hp-sev-wrap" style={{ position: 'relative', flexShrink: 0 }}>
                <div onClick={() => setShowSevDrop(v => !v)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px 7px 12px', borderRadius: 8,
                  border: `1px solid ${border}`, background: inputBg, cursor: 'pointer', fontSize: '0.82rem',
                  color: filters.severity ? '#059669' : textMuted, fontWeight: filters.severity ? 600 : 500, userSelect: 'none', whiteSpace: 'nowrap',
                }}>
                  <span>{filters.severity ? SEV_META[filters.severity]?.label : 'All Severities'}</span>
                  <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                {showSevDrop && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 300, background: surface, border: `1.5px solid ${border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 160, overflow: 'hidden' }}>
                    {[{ value: '', label: 'All Severities' }, ...Object.entries(SEV_META).map(([k, v]) => ({ value: k, label: v.label }))].map(opt => (
                      <div key={opt.value} onClick={() => { setFilters(f => ({ ...f, severity: opt.value })); setPage(1); setShowSevDrop(false); }} style={{
                        padding: '9px 14px', cursor: 'pointer', fontSize: '0.85rem',
                        background: filters.severity === opt.value ? (dark ? '#0d2619' : '#f0fdf4') : 'transparent',
                        color: filters.severity === opt.value ? '#059669' : (dark ? '#7ab89a' : '#374151'),
                        fontWeight: filters.severity === opt.value ? 600 : 400,
                        borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f7f7f7'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                        onMouseEnter={e => { if (filters.severity !== opt.value) e.currentTarget.style.background = dark ? '#132a1e' : '#f8faf9'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = filters.severity === opt.value ? (dark ? '#0d2619' : '#f0fdf4') : 'transparent'; }}
                      >
                        {opt.label}
                        {filters.severity === opt.value && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center', color: textMuted, fontSize: '0.875rem' }}>Loading logs…</div>
            ) : error ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#ef4444', fontSize: '0.875rem' }}>{error}</div>
            ) : logs.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: textMuted, fontSize: '0.875rem' }}>No activity logs found.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: dark ? '#0f2417' : '#f9fafb', borderBottom: `1px solid ${border}` }}>
                      {['Timestamp', 'Type', 'Severity', 'IP Address', 'Fingerprint', 'Tags'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: textMuted, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => {
                      const sev = SEV_META[log.severity] || SEV_META.info;
                      return (
                        <tr key={log.sessionId + i} className="hp-row" style={{ borderBottom: `1px solid ${border}` }}>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: textMuted, fontSize: '0.78rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: textMain }}>{log.activityType}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
                              color: dark ? sev.darkColor : sev.color, background: dark ? sev.darkBg : sev.bg,
                            }}>{sev.label}</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: textMain }}>{log.ipAddress}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: textMuted, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.deviceFingerprint}>{log.deviceFingerprint || '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(Array.isArray(log.tags) ? log.tags : (log.tags || '').split('|')).filter(Boolean).map(tag => (
                                <span key={tag} style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, background: dark ? '#1e3a2a' : '#f3f4f6', color: dark ? '#7ab89a' : '#4b5563', border: `1px solid ${border}` }}>{tag}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 0 && (
              <div className="hp-pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: `1px solid ${border}`, flexWrap: 'wrap', gap: 8, background: dark ? '#0d2619' : '#f7faf8', borderRadius: '0 0 12px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: dark ? '#4d8a6a' : '#9ca3af', fontWeight: 500 }}>
                    Showing page {page} of {totalPages}
                  </span>
                  <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                    style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${dark ? '#1e3a2a' : '#d4e8dd'}`, background: dark ? '#0d2619' : '#fff', color: dark ? '#7ab89a' : '#374151', fontSize: 11, fontWeight: 600, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
                    {[25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['prev', page <= 1, () => setPage(p => Math.max(1, p - 1))], ['next', page >= totalPages, () => setPage(p => Math.min(totalPages, p + 1))]].map(([dir, disabled, onClick]) => (
                    <button key={dir} onClick={onClick} disabled={disabled}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${dark ? '#1e3a2a' : '#d4e8dd'}`, background: disabled ? (dark ? '#0a1a10' : '#f9fafb') : (dark ? '#0d2619' : '#fff'), color: disabled ? (dark ? '#2a4a35' : '#d1d5db') : (dark ? '#7ab89a' : '#374151'), fontSize: '0.78rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
                      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = dark ? '#132a1e' : '#eaf8f1'; e.currentTarget.style.borderColor = '#1e8760'; e.currentTarget.style.color = '#1e8760'; }}}
                      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = dark ? '#0d2619' : '#fff'; e.currentTarget.style.borderColor = dark ? '#1e3a2a' : '#d4e8dd'; e.currentTarget.style.color = dark ? '#7ab89a' : '#374151'; }}}
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
      </div>
    </div>
  );
}
