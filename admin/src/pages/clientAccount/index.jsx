// src/pages/clientAccount/index.jsx
import { useState } from 'react';
import Sidebar from '../Sidebar';
import { useClientAccounts } from './hooks/useClientAccounts';
import ClientAccountModal from './components/ClientAccountModal';
import DeleteModal from './components/DeleteModal';
import ClientAccountTable from './components/ClientAccountTable';
import './clientAccount.css';

export default function ClientAccount() {
  const [filterParent, setFilterParent] = useState('');
  const [search, setSearch]             = useState('');
  const [modal, setModal]               = useState(null); // null | { type: 'create'|'edit'|'delete', account? }

  const { accounts, clients, loading, error, propertyMap, reload } = useClientAccounts(filterParent);

  const filtered = accounts.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.firstName?.toLowerCase().includes(q) ||
      a.lastName?.toLowerCase().includes(q)  ||
      a.email?.toLowerCase().includes(q)
    );
  });

  function handleSaved() {
    setModal(null);
    reload();
  }

  function handleDeleted() {
    setModal(null);
    reload();
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
          {/* Modals */}
          {modal?.type === 'create' && (
            <ClientAccountModal
              mode="create"
              clients={clients}
              onClose={() => setModal(null)}
              onSaved={handleSaved}
            />
          )}
          {modal?.type === 'edit' && (
            <ClientAccountModal
              mode="edit"
              account={modal.account}
              clients={clients}
              onClose={() => setModal(null)}
              onSaved={handleSaved}
            />
          )}
          {modal?.type === 'delete' && (
            <DeleteModal
              account={modal.account}
              onClose={() => setModal(null)}
              onDeleted={handleDeleted}
            />
          )}

          {/* Page Header */}
          <header className="db-content__header">
            <div>
              <h1 className="db-content__title">Client Accounts</h1>
              <p className="db-content__sub">
                Manage sub-accounts linked to your client users
              </p>
            </div>
            <button
              onClick={() => setModal({ type: 'create' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 18px',
                borderRadius: 9,
                border: 'none',
                background: '#1555C0',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M7 1v12M1 7h12" strokeLinecap="round" />
              </svg>
              New Client Account
            </button>
          </header>

          <ClientAccountTable
            accounts={accounts}
            clients={clients}
            filtered={filtered}
            loading={loading}
            error={error}
            search={search}
            filterParent={filterParent}
            propertyMap={propertyMap}
            onSearchChange={setSearch}
            onFilterParentChange={setFilterParent}
            onEdit={(a) => setModal({ type: 'edit', account: a })}
            onDelete={(a) => setModal({ type: 'delete', account: a })}
          />
        </div>
      </div>
    </div>
  );
}
