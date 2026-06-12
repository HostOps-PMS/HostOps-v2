import { useState }       from 'react';
import Sidebar            from '../Sidebar';
import TopBar             from '../dashboard/components/TopBar';
import AccountsTable      from './components/AccountsTable';
import UnlockModal        from './components/UnlockModal';
import { useAccounts, useFilteredAccounts } from './hooks/useAccounts';
import { exportAccountsPdf } from './utils/exportAccountsPdf';
import './index.css';

const PAGE_SIZE = 10;

export default function AccountsPage() {
  const { users, staffs, combined, loading, error, reload } = useAccounts();

  const [tab,          setTab]          = useState('all');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [unlockTarget, setUnlockTarget] = useState(null);

  const now         = new Date();
  const lockedCount = combined.filter(a =>
    a.pinPermanentlyLocked ||
    (a.pinLockedUntil && new Date(a.pinLockedUntil) > now) ||
    a.pinAttempts > 0
  ).length;

  const tabs = [
    { id: 'all',    label: 'All',        count: combined.length },
    { id: 'users',  label: 'Users',      count: users.length },
    { id: 'staffs', label: 'Staffs',     count: staffs.length },
    { id: 'locked', label: 'PIN Issues', count: lockedCount, warn: lockedCount > 0 },
  ];

  const { filtered, totalFiltered, totalPages } = useFilteredAccounts({
    combined, tab, search, page, pageSize: PAGE_SIZE,
  });

  const [exportLoading, setExportLoading] = useState(false);

  async function handleExport() {
    if (exportLoading || loading) return;
    setExportLoading(true);
    try {
      await exportAccountsPdf({ accounts: totalFiltered, tab, search });
    } finally {
      setExportLoading(false);
    }
  }

  function handleTabChange(id) { setTab(id); setPage(1); }
  function handleSearch(val)   { setSearch(val); setPage(1); }

  return (
    <div className="db-layout">
      <Sidebar />

      <div className="db-main">
        <TopBar />

        <div className="cl-content">
          <header className="cl-content__header" style={{ marginBottom: 28 }}>
            <div>
              <h1 className="cl-content__title">Accounts</h1>
              <p className="cl-content__sub">All platform users and staffs — PIN lockout status, attempts, and access control.</p>
            </div>
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
              title="Export visible accounts as PDF"
            >
              {exportLoading ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                  style={{ animation: 'ac-pdf-spin 0.8s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 16h14" strokeLinecap="round" />
                </svg>
              )}
              {exportLoading ? 'Exporting…' : 'Export PDF'}
            </button>
            <style>{`@keyframes ac-pdf-spin { to { transform: rotate(360deg); } }`}</style>
          </header>

          <AccountsTable
            tabs={tabs} activeTab={tab} onTabChange={handleTabChange}
            filtered={filtered} totalFiltered={totalFiltered} combined={combined}
            loading={loading} error={error}
            search={search} onSearchChange={handleSearch}
            page={page} totalPages={totalPages} onPageChange={setPage}
            onUnlock={setUnlockTarget} onRefresh={reload}
          />
        </div>
      </div>

      {unlockTarget && (
        <UnlockModal account={unlockTarget} onClose={() => setUnlockTarget(null)} onUnlocked={reload} />
      )}
    </div>
  );
}