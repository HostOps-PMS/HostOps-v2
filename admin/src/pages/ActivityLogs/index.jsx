// src/pages/ActivityLogs/index.jsx
import { useState } from 'react';
import Sidebar from '../Sidebar';
import TopBar from '../dashboard/components/TopBar';
import { useActivityLogs } from './hooks/useActivityLogs';
import ActivityLogTable from './components/ActivityLogTable';

const PAGE_SIZE = 15;

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
        <TopBar />

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