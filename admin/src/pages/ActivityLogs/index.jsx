// src/pages/ActivityLogs/index.jsx
import { useState } from 'react';
import Sidebar from '../Sidebar';
import { useActivityLogs } from './hooks/useActivityLogs';
import ActivityLogTable from './components/ActivityLogTable';

const PAGE_SIZE = 50;

export default function ActivityLogs() {
  const [search,         setSearch]         = useState('');
  const [filterClient,   setFilterClient]   = useState('');
  const [filterAction,   setFilterAction]   = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');
  const [page,           setPage]           = useState(1);

  // Pass each filter as a separate primitive — never as an object literal.
  // Object literals are recreated every render, causing infinite re-fetch loops.
  const { logs, clients, pagination, loading, error } = useActivityLogs({
    page,
    limit:  PAGE_SIZE,
    userId: filterClient,
    action: filterAction,
    from:   filterDateFrom,
    to:     filterDateTo ? filterDateTo + 'T23:59:59' : '',
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
        {/* TopBar */}
        <header className="db-topbar">
          <div className="db-topbar__search">
            <span className="db-topbar__search-icon">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="9" r="7" />
                <path d="M15 15l3 3" strokeLinecap="round" />
              </svg>
            </span>
            <input type="text" placeholder="Search…" />
          </div>
          <div className="db-topbar__actions">
            <button className="db-topbar__icon-btn" title="Notifications">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10 2a6 6 0 00-6 6v3l-1.5 2H17.5L16 11V8a6 6 0 00-6-6z" />
                <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round" />
              </svg>
            </button>
            <div className="db-topbar__avatar" title="Admin User">A</div>
          </div>
        </header>

        <div className="cl-content">
          {/* Page Header */}
          <header className="cl-content__header">
            <div>
              <h1 className="cl-content__title">Activity Logs</h1>
              <p className="cl-content__sub">Track all actions performed across businesses and staff accounts</p>
            </div>
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
            totalPages={pagination.pages}
            totalCount={pagination.total}
            onPrev={() => setPage(p => Math.max(1, p - 1))}
            onNext={() => setPage(p => Math.min(pagination.pages, p + 1))}
          />
        </div>
      </div>
    </div>
  );
}