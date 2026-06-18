// src/pages/ActivityLogs/index.jsx
import { useState, useEffect, useRef } from 'react';
import Sidebar from '../Sidebar';
import TopBar from '../dashboard/components/TopBar';
import { useActivityLogs } from './hooks/useActivityLogs';
import ActivityLogTable from './components/ActivityLogTable';

export default function ActivityLogs() {
  const [search,         setSearch]         = useState('');
  const [filterClient,   setFilterClient]   = useState('');
  const [filterAction,   setFilterAction]   = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');
  const [page,           setPage]           = useState(1);
  const [pageSize,       setPageSize]       = useState(50);
  const [liveMode,       setLiveMode]       = useState(false);
  const [liveTick,       setLiveTick]       = useState(0);

  // Live mode polling
  useEffect(() => {
    if (!liveMode) return;
    const id = setInterval(() => setLiveTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, [liveMode]);

  const { logs, clients, pagination, loading, error, refetch } = useActivityLogs({
    page,
    limit:  pageSize,
    userId: filterClient,
    action: filterAction,
    from:   filterDateFrom,
    to:     filterDateTo ? filterDateTo + 'T23:59:59' : '',
    _poll:  liveTick,
  });

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

  function handleSearchChange(val) {
    setSearch(val);
    // search is client-side only — no need to reset page
  }

  function handleFilterClientChange(val) {
    setFilterClient(val);
    setPage(1);
  }

  function handleFilterActionChange(val) {
    setFilterAction(val);
    setPage(1);
  }

  function handleFilterDateFromChange(val) {
    setFilterDateFrom(val);
    setPage(1);
  }

  function handleFilterDateToChange(val) {
    setFilterDateTo(val);
    setPage(1);
  }

  function handleClearFilters() {
    setSearch('');
    setFilterClient('');
    setFilterAction('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  }

  return (
    <div className="db-layout">
      <Sidebar />

      <div className="db-main">
        <TopBar />

        <div className="cl-content">
          <style>{`
            .al-live-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 9px; font-size: 0.82rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; border: 1.5px solid; white-space: nowrap; }
            .al-live-label { display: inline; }
            @keyframes al-header-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
            @media (max-width: 768px) {
              .al-live-btn { width: 38px; height: 38px; padding: 0; justify-content: center; border-radius: 12px; }
              .al-live-label { display: none; }
            }
          `}</style>
          {/* Page Header */}
          <header className="cl-content__header">
            <div>
              <h1 className="cl-content__title">Activity Logs</h1>
              <p className="cl-content__sub">Track all actions performed across businesses and staff accounts</p>
            </div>
            <button
              onClick={() => setLiveMode(v => !v)}
              className="al-live-btn"
              style={{
                background: liveMode ? '#052e16' : 'transparent',
                borderColor: liveMode ? '#22c55e' : '#dc2626',
                color: liveMode ? '#22c55e' : '#dc2626',
              }}
              title={liveMode ? 'Live — auto-refreshing every 5s' : 'Stopped — click to enable live mode'}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: liveMode ? '#22c55e' : '#dc2626',
                animation: liveMode ? 'al-header-pulse 1.5s infinite' : 'none',
                flexShrink: 0,
              }} />
              <span className="al-live-label">{liveMode ? 'Live' : 'Stopped'}</span>
            </button>
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
            pageSize={pageSize}
            onPageSizeChange={v => { setPageSize(v); setPage(1); }}
            liveMode={liveMode}
            onLiveModeChange={setLiveMode}
          />
        </div>
      </div>
    </div>
  );
}