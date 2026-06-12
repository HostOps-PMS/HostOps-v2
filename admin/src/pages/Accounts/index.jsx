import { useState }       from 'react';
import Sidebar            from '../Sidebar';
import AccountsTable      from './components/AccountsTable';
import UnlockModal        from './components/UnlockModal';
import { useAccounts, useFilteredAccounts } from './hooks/useAccounts';
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

  function handleTabChange(id) { setTab(id); setPage(1); }
  function handleSearch(val)   { setSearch(val); setPage(1); }

  return (
    <div className="db-layout">
      <Sidebar />

      <div className="db-main">
        {/* TopBar */}
        <header className="db-topbar">
          <div className="db-topbar__search">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>
              <circle cx="9" cy="9" r="7"/><path d="M15 15l3 3" strokeLinecap="round"/>
            </svg>
            <input type="text" placeholder="Search…" />
          </div>
          <div className="db-topbar__actions">
            <button className="db-topbar__icon-btn" title="Notifications">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10 2a6 6 0 00-6 6v3l-1.5 2H17.5L16 11V8a6 6 0 00-6-6z"/>
                <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round"/>
              </svg>
            </button>
            <div className="db-topbar__avatar" title="Admin User">A</div>
          </div>
        </header>

        <div className="cl-content">
          <header style={{ marginBottom: 28 }}>
            <h1 className="cl-content__title">Accounts</h1>
            <p className="cl-content__sub">All platform users and staffs — PIN lockout status, attempts, and access control.</p>
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