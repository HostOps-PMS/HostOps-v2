import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext'; 
import Sidebar from './Sidebar';
import './dashboard/dashboard.css';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/internal/ops` : '/internal/ops';

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export default function HoneypotDashboard() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ severity: '', activityType: '', fingerprint: '', ip: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [logsError, setLogsError] = useState(false);
  const { getToken, fetchWithAuth } = useAuth();
  const adminToken = getToken();

  useEffect(() => {
    if (!adminToken) return;
    fetchWithAuth(`${API_BASE}/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStatsError(true));
  }, [adminToken, fetchWithAuth]);

  async function downloadFile(endpoint, filename) {
    try {
      const res = await fetchWithAuth(`${API_BASE}/${endpoint}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to download file');
    }
  }

  useEffect(() => {
    if (!adminToken) return;
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 25, ...filters });
    Object.keys(filters).forEach((k) => !filters[k] && params.delete(k));

    fetchWithAuth(`${API_BASE}/logs?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs || []);
        setTotalPages(data.totalPages || 1);
        setLogsError(false);
      })
      .catch(() => setLogsError(true))
      .finally(() => setLoading(false));
  }, [page, filters, adminToken]);

  return (
    <div className="db-layout">
      <Sidebar />
      <div className="db-main" style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', padding: '32px 48px', boxSizing: 'border-box', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, color: '#111827', fontWeight: 700 }}>Honeypot Security</h1>
              <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>Threat monitoring and deception telemetry</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => downloadFile('download/events', 'honeypot-events.csv')}
                style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Events CSV
              </button>
              <button 
                onClick={() => downloadFile('download/blocklist', 'honeypot-blocklist.csv')} 
                style={{ padding: '8px 16px', background: '#ef4444', border: '1px solid #ef4444', borderRadius: 6, fontSize: 13, fontWeight: 500, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                Blocklist CSV
              </button>
            </div>
          </div>

          {statsError ? (
            <div style={{ padding: '16px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Failed to load telemetry stats. The backend might be unreachable.
            </div>
          ) : stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 32 }}>
              <StatCard title="Total Events (24h)" value={stats.last24h} icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" color="#3b82f6" />
              <StatCard title="Critical Threats (24h)" value={stats.criticalLast24h} icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" color="#ef4444" />
              <StatCard title="Banned Devices" value={stats.bannedTotal} icon="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" color="#8b5cf6" />
            </div>
          )}

          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 12, background: '#f9fafb' }}>
              <select
                value={filters.severity}
                onChange={(e) => { setPage(1); setFilters({ ...filters, severity: e.target.value }); }}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff', color: '#374151', outline: 'none' }}
              >
                <option value="">All Severities</option>
                <option value="info">Info</option>
                <option value="suspicious">Suspicious</option>
                <option value="critical">Critical</option>
              </select>
              <input
                placeholder="Filter by IP Address"
                value={filters.ip}
                onChange={(e) => { setPage(1); setFilters({ ...filters, ip: e.target.value }); }}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, flex: 1, outline: 'none' }}
              />
              <input
                placeholder="Filter by Fingerprint"
                value={filters.fingerprint}
                onChange={(e) => { setPage(1); setFilters({ ...filters, fingerprint: e.target.value }); }}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, flex: 1, outline: 'none' }}
              />
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead style={{ background: '#f9fafb', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11 }}>
                  <tr>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Timestamp</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Type</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Severity</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>IP Address</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Fingerprint</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Tags</th>
                  </tr>
                </thead>
                <tbody style={{ color: '#374151' }}>
                  {loading ? (
                    <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>Loading logs...</td></tr>
                  ) : logsError ? (
                    <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#ef4444' }}>Failed to load logs.</td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>No activity logs found.</td></tr>
                  ) : (
                    logs.map((log, i) => (
                      <tr key={log.sessionId + i} style={{ borderTop: '1px solid #f3f4f6', transition: 'background-color 0.15s ease' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ padding: '16px 20px', whiteSpace: 'nowrap', color: '#6b7280' }}>{new Date(log.timestamp).toLocaleString()}</td>
                        <td style={{ padding: '16px 20px', fontWeight: 500 }}>{log.activityType}</td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{
                            padding: '4px 10px', 
                            borderRadius: '9999px', 
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.02em',
                            background: log.severity === 'critical' ? '#fee2e2' : log.severity === 'suspicious' ? '#fef3c7' : '#d1fae5',
                            color: log.severity === 'critical' ? '#991b1b' : log.severity === 'suspicious' ? '#92400e' : '#065f46'
                          }}>
                            {log.severity.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', fontFamily: 'monospace', fontSize: 13 }}>{log.ipAddress}</td>
                        <td style={{ padding: '16px 20px', fontFamily: 'monospace', fontSize: 13, color: '#6b7280' }} title={log.deviceFingerprint}>{(log.deviceFingerprint || '').slice(0, 12)}…</td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(log.tags || '').split('|').map(tag => tag ? (
                              <span key={tag} style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 11, color: '#4b5563', border: '1px solid #e5e7eb' }}>
                                {tag}
                              </span>
                            ) : null)}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Showing page {page} of {totalPages}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 500, color: page <= 1 ? '#9ca3af' : '#374151', cursor: page <= 1 ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>Previous</button>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 500, color: page >= totalPages ? '#9ca3af' : '#374151', cursor: page >= totalPages ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div style={{ background: '#fff', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ background: `${color}15`, color: color, padding: 16, borderRadius: '50%' }}>
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={icon}></path></svg>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{value ?? '0'}</div>
      </div>
    </div>
  );
}
