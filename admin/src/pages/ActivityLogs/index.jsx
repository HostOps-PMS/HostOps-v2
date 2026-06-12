// src/pages/ActivityLogs/index.jsx
import { useState } from 'react';
import Sidebar from '../Sidebar';
import TopBar from '../dashboard/components/TopBar';
import { useStats } from '../dashboard/hooks/useStats';
import { useActivityLogs } from './hooks/useActivityLogs';
import ActivityLogTable from './components/ActivityLogTable';
import { exportActivityLogs } from './services/activityLogApi';
import { exportActivityLogsPdf } from './utils/exportActivityLogsPdf';

const PAGE_SIZE = 15;

export default function ActivityLogs() {
  const [search,         setSearch]         = useState('');
  const [filterClient,   setFilterClient]   = useState('');
  const [filterAction,   setFilterAction]   = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');
  const [page,           setPage]           = useState(1);

  const { logs, clients, pagination, loading, error } = useActivityLogs({
    page,
    limit:  PAGE_SIZE,
    userId: filterClient,
    action: filterAction,
    from:   filterDateFrom,
    to:     filterDateTo ? filterDateTo + 'T23:59:59' : '',
  });

  /* ── Alerts + Activity from dashboard overview ── */
  const { overview, loading: notifLoading } = useStats();

  // Client-side text search layered on top of server-side results
  const filtered = logs.filter(log => {
    if (!search) return true;
    const q  = search.toLowerCase();
    const pb = log.performedBy || {};
    return (
      pb.firstName?.toLowerCase().includes(q) ||
      pb.lastName?.toLowerCase().includes(q)  ||
      pb.email?.toLowerCase().includes(q)     ||
      log.action?.toLowerCase().includes(q)   ||
      log.businessName?.toLowerCase().includes(q)
    );
  });

  function handleSearchChange(val)      { setSearch(val); }
  function handleFilterClientChange(val){ setFilterClient(val); setPage(1); }
  function handleFilterActionChange(val){ setFilterAction(val); setPage(1); }
  function handleFilterDateFromChange(val){ setFilterDateFrom(val); setPage(1); }
  function handleFilterDateToChange(val)  { setFilterDateTo(val);   setPage(1); }

  function handleClearFilters() {
    setSearch(''); setFilterClient(''); setFilterAction('');
    setFilterDateFrom(''); setFilterDateTo(''); setPage(1);
  }

  /* ── Export PDF — fetches ALL pages from server then prints ── */
  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async () => {
    if (exportLoading || loading) return;
    setExportLoading(true);
    try {
      await exportActivityLogsPdf({
        exportFn: () => exportActivityLogs({
          userId: filterClient,
          action: filterAction,
          from:   filterDateFrom,
          to:     filterDateTo ? filterDateTo + 'T23:59:59' : '',
        }),
        search,
        filterClient,
        filterAction,
        filterDateFrom,
        filterDateTo,
      });
    } catch (err) {
      console.error('[exportActivityLogsPdf] failed:', err);
    } finally {
      setExportLoading(false);
    }
  };

  const exportBtnIcon = exportLoading ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      style={{ animation: 'al-pdf-spin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 16h14" strokeLinecap="round" />
    </svg>
  );

  return (
    <div className="db-layout">
      {/* Pass handleExport to Sidebar so mobile top bar shows Export PDF on this page */}
      <Sidebar onExport={handleExport} exportLoading={exportLoading} />

      <div className="db-main">
        <TopBar
          alerts={overview?.alerts ?? []}
          activities={overview?.recentActivities ?? []}
          notifLoading={notifLoading}
        />

        <div className="cl-content">
          {/* Page Header */}
          <header className="cl-content__header">
            <div>
              <h1 className="cl-content__title">Activity Logs</h1>
              <p className="cl-content__sub">Track all actions performed across businesses and staff accounts</p>
            </div>

            {/* Export PDF button — desktop/tablet */}
            <button
              onClick={handleExport}
              disabled={exportLoading || loading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 18px',
                background: (exportLoading || loading) ? '#e0e0e0' : '#1a9e6e',
                color: (exportLoading || loading) ? '#aaa' : '#fff',
                border: 'none', borderRadius: 10,
                cursor: (exportLoading || loading) ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem', fontWeight: 600,
                letterSpacing: '0.01em', whiteSpace: 'nowrap',
                transition: 'background 0.15s',
                boxShadow: (exportLoading || loading) ? 'none' : '0 2px 8px rgba(26,158,110,0.18)',
              }}
              onMouseEnter={e => { if (!exportLoading && !loading) e.currentTarget.style.background = '#158a5e'; }}
              onMouseLeave={e => { if (!exportLoading && !loading) e.currentTarget.style.background = '#1a9e6e'; }}
              title="Export all activity logs as PDF"
            >
              {exportBtnIcon}
              {exportLoading ? 'Fetching logs…' : 'Export PDF'}
            </button>
            <style>{`@keyframes al-pdf-spin { to { transform: rotate(360deg); } }`}</style>
          </header>

          {error && (
            <div style={{
              background: '#fee2e2', color: '#b91c1c',
              borderRadius: 'var(--radius-sm)', padding: '12px 16px',
              fontSize: '.875rem', fontWeight: 500,
            }}>
              ⚠️ {error}
            </div>
          )}

          <ActivityLogTable
            logs={filtered}
            clients={clients}
            loading={loading}
            search={search}
            filterClient={filterClient}
            filterAction={filterAction}
            filterDateFrom={filterDateFrom}
            filterDateTo={filterDateTo}
            onSearchChange={handleSearchChange}
            onFilterClientChange={handleFilterClientChange}
            onFilterActionChange={handleFilterActionChange}
            onFilterDateFromChange={handleFilterDateFromChange}
            onFilterDateToChange={handleFilterDateToChange}
            onClearFilters={handleClearFilters}
            page={page}
            totalPages={pagination?.pages ?? 1}
            totalCount={pagination?.total ?? 0}
            onPrev={() => setPage(p => Math.max(1, p - 1))}
            onNext={() => setPage(p => Math.min(pagination?.pages ?? 1, p + 1))}
          />
        </div>
      </div>
    </div>
  );
}