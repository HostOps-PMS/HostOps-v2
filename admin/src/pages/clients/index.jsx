import { useState, useMemo, useRef, useCallback } from 'react';
import './clients.css';

import Sidebar           from '../Sidebar';
import TopBar            from '../dashboard/components/TopBar';
import ClientsTable      from './components/ClientsTable';
import ClientModal          from './components/ClientModal';
import AddClientModal       from './components/AddClientModal';
import { useClients }       from './hooks/useClients';
import { exportClientsPdf } from './utils/exportClientsPdf';

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
  const [page,       setPage]       = useState(1);
  const PAGE_SIZE = 10;

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

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when search changes
  function handleSearchChange(val) {
    setSearch(val);
    setPage(1);
  }

  /* ── Handle client updated from modal ── */
  function handleClientUpdated(updatedClient) {
    // Refresh the full list so the table reflects the changes
    refetch();
    // Update the selected client in-place so the modal shows fresh data
    setSelectedClient(updatedClient);
  }

  /* ── Export PDF ─────────────────────────────────────────────────
     visibleClientsRef always holds the currently tab-filtered rows
     as reported by ClientsTable via onVisibleClientsChange.
     This means the export reflects BOTH the search filter (from this
     component) AND the active tab filter (from ClientsTable).
  ── */
  const visibleClientsRef = useRef({ clients: filtered, activeTab: 'All' });

  const handleVisibleClientsChange = useCallback((clients, activeTab) => {
    visibleClientsRef.current = { clients, activeTab };
  }, []);

  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async () => {
    if (exportLoading || loading) return;
    setExportLoading(true);
    try {
      const { clients: visibleClients, activeTab } = visibleClientsRef.current;
      await exportClientsPdf({ clients: visibleClients, activeTab, search });
    } catch (err) {
      console.error('[exportClientsPdf] failed:', err);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="db-layout">
      <Sidebar />

      <div className="db-main">
        <TopBar />

        {/* Page content */}
        <div className="cl-content">
          {/* Page header */}
          <header className="cl-content__header">
            <div>
              <h1 className="cl-content__title">Businesses</h1>
              <p className="cl-content__sub">All registered users on the platform</p>
            </div>

            {/* Export PDF — reflects current tab + search filter */}
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
              title="Export visible businesses as PDF"
            >
              {exportLoading ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                  style={{ animation: 'cl-pdf-spin 0.8s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 16h14" strokeLinecap="round" />
                </svg>
              )}
              <span className="cl-export-label">{exportLoading ? 'Exporting…' : 'Export PDF'}</span>
            </button>
            <style>{`
            @keyframes cl-pdf-spin { to { transform: rotate(360deg); } }
            @media (max-width: 768px) {
              .cl-export-label { display: none; }
            }
          `}</style>
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

          {/* Table */}
          <ClientsTable
            clients={paginated}
            loading={loading}
            onRowClick={openModal}
            search={search}
            onSearchChange={handleSearchChange}
            onAddClient={() => setShowAddClient(true)}
            onRefresh={refetch}
            page={page}
            totalPages={totalPages}
            totalCount={filtered.length}
            onPrev={() => setPage(p => Math.max(1, p - 1))}
            onNext={() => setPage(p => Math.min(totalPages, p + 1))}
            onVisibleClientsChange={handleVisibleClientsChange}
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