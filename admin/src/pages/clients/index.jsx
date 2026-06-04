import { useState, useMemo } from 'react';
import './clients.css';

import Sidebar           from '../Sidebar';
import ClientsTable      from './components/ClientsTable';
import ClientModal          from './components/ClientModal';
import AddClientModal       from './components/AddClientModal';
import { useClients }       from './hooks/useClients';

export default function Clients() {
  /* ── View-client modal ── */
  const [selectedClient, setSelectedClient] = useState(null);
  const openModal  = (client) => setSelectedClient(client);
  const closeModal = ()       => setSelectedClient(null);

  /* ── Add Modals ── */
  const [showAddClient, setShowAddClient] = useState(false);

  /* ── Data ── */
  const { clients, loading, error, refetch } = useClients();

  /* ── Search / filter ── */
  const [search,     setSearch]     = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      const matchesSearch =
        !q ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (`${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().includes(q));

      return matchesSearch && c.role === 'client';
    });
  }, [clients, search]);

  /* ── Handle client updated from modal ── */
  function handleClientUpdated(updatedClient) {
    // Refresh the full list so the table reflects the changes
    refetch();
    // Update the selected client in-place so the modal shows fresh data
    setSelectedClient(updatedClient);
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

        {/* Page content */}
        <div className="cl-content">
          {/* Page header */}
          <header className="cl-content__header">
            <div>
              <h1 className="cl-content__title">Businesses</h1>
              <p className="cl-content__sub">All registered users on the platform</p>
            </div>
            <div className="cl-header-actions">
              <button
                className="db-btn db-btn--primary"
                onClick={() => setShowAddClient(true)}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                </svg>
                Add Business
              </button>
              <button className="db-btn db-btn--ghost" onClick={refetch} title="Refresh">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4a8 8 0 0112.97 3M16 16a8 8 0 01-12.97-3" strokeLinecap="round" />
                  <path d="M4 8V4H0" strokeLinecap="round" strokeLinejoin="round" transform="translate(4 0)" />
                </svg>
                Refresh
              </button>
            </div>
          </header>

          {/* Error banner */}
          {error && (
            <div style={{
              background: '#fee2e2', color: '#b91c1c',
              borderRadius: 'var(--radius-sm)', padding: '12px 16px',
              fontSize: '.875rem', fontWeight: 500,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Filter bar */}
          <div className="cl-filterbar">
            <div className="cl-search">
              <span className="cl-search__icon">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="9" r="7" />
                  <path d="M15 15l3 3" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <ClientsTable
            clients={filtered}
            loading={loading}
            onRowClick={openModal}
          />
        </div>
      </div>

      {/* View / edit client modal */}
      {selectedClient && (
        <ClientModal
          client={selectedClient}
          onClose={closeModal}
          onUpdated={handleClientUpdated}
        />
      )}

      {/* Add Client modal */}
      {showAddClient && (
        <AddClientModal
          onClose={() => setShowAddClient(false)}
          onSuccess={() => { setShowAddClient(false); refetch(); }}
        />
      )}
    </div>
  );
}