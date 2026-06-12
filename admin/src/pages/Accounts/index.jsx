import { useState }       from 'react';
import Sidebar            from '../Sidebar';
import TopBar             from '../dashboard/components/TopBar';
import AccountsTable      from './components/AccountsTable';
import UnlockModal        from './components/UnlockModal';
import { useAccounts, useFilteredAccounts } from './hooks/useAccounts';
import { useStats }       from '../dashboard/hooks/useStats';
import { exportAccountsPdf } from './utils/exportAccountsPdf';
import './index.css';

const PAGE_SIZE = 10;

export default function AccountsPage() {
  const { users, staffs, combined, loading, error, reload } = useAccounts();

  const [tab,          setTab]          = useState('all');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [unlockTarget, setUnlockTarget] = useState(null);

  /* ── Alerts + Activity from dashboard overview ── */
  const { overview, loading: notifLoading } = useStats();

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

  function handleTabChange(id) { setTab(id); setPage(1); }
  function handleSearch(val)   { setSearch(val); setPage(1); }

  /* ── Export PDF — exports ALL filtered records across all pages ── */
  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = () => {
    if (exportLoading || loading) return;
    setExportLoading(true);
    try {
      exportAccountsPdf({
        accounts: totalFiltered,
        activeTab: tab,
        search,
      });
    } catch (err) {
      console.error('[exportAccountsPdf] failed:', err);
    } finally {
      setExportLoading(false);
    }
  };

  const exportBtnIcon = exportLoading ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      style={{ animation: 'acc-pdf-spin 0.8s linear infinite' }}>
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
          <header style={{ marginBottom: 28 }} className="cl-content__header">
            <div>
              <h1 className="cl-content__title">Accounts</h1>
              <p className="cl-content__sub">All platform users and staffs — PIN lockout status, attempts, and access control.</p>
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
              title="Export all accounts as PDF"
            >
              {exportBtnIcon}
              {exportLoading ? 'Exporting…' : 'Export PDF'}
            </button>
            <style>{`@keyframes acc-pdf-spin { to { transform: rotate(360deg); } }`}</style>
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