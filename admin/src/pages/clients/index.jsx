import { useState, useMemo, useRef, useCallback } from 'react';
import './clients.css';

import Sidebar           from '../Sidebar';
import TopBar            from '../dashboard/components/TopBar';
import ClientsTable      from './components/ClientsTable';
import ClientModal          from './components/ClientModal';
import AddClientModal       from './components/AddClientModal';
import { useClients }       from './hooks/useClients';
import { exportClientsPdf } from './utils/exportClientsPdf';
import { archiveClient } from './services/clientsService';
import { toast } from '../../utils/toast';
import ArchiveConfirmModal from '../components/ArchiveConfirmModal';

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

  /* ── Archive confirm modal ── */
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving]         = useState(false);

  async function confirmArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await archiveClient(archiveTarget._id);
      const name = archiveTarget.businessName || archiveTarget.email;
      toast.success(`${name} has been archived.`, { title: 'Business Archived' });
      refetch();
      setArchiveTarget(null);
    } catch (err) {
      toast.error('Failed to archive business. Please try again.', { title: 'Archive Failed' });
      console.error('[archiveClient]', err);
    } finally {
      setArchiving(false);
    }
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Add Business button */}
              <button
                onClick={() => setShowAddClient(true)}
                className="cl-add-btn"
                onMouseEnter={e => { e.currentTarget.style.background = '#059669'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#10b981'; }}
                title="Add Business"
              >
                <span className="cl-add-icon">+</span>
                <span className="cl-add-label">Add Business</span>
              </button>

              {/* Export PDF — reflects current tab + search filter */}
              <button
                onClick={handleExport}
                disabled={exportLoading || loading}
                style={{
                  background: (exportLoading || loading) ? '#f3f4f6' : undefined,
                  color: (exportLoading || loading) ? '#aaa' : undefined,
                  border: (exportLoading || loading) ? '1px solid #e5e7eb' : undefined,
                  cursor: (exportLoading || loading) ? 'not-allowed' : undefined,
                  opacity: (exportLoading || loading) ? 0.7 : 1,
                }}
                onMouseEnter={e => { if (!exportLoading && !loading) e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={e => { if (!exportLoading && !loading) e.currentTarget.style.background = '#fff'; }}
                title="Export visible businesses as PDF"
                className="cl-export-btn"
              >
                {exportLoading ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                    style={{ animation: 'cl-pdf-spin 0.8s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 16h14" strokeLinecap="round" />
                  </svg>
                )}
                <span className="cl-export-label">{exportLoading ? 'Exporting…' : 'Export PDF'}</span>
              </button>
            </div>
            <style>{`
            @keyframes cl-pdf-spin { to { transform: rotate(360deg); } }

            .cl-add-btn {
              display: inline-flex; align-items: center; gap: 7px;
              padding: 9px 16px;
              background: #10b981; color: #fff;
              border: none; border-radius: 10px;
              cursor: pointer; font-size: 0.875rem; font-weight: 600;
              transition: background 0.15s; white-space: nowrap;
              box-shadow: 0 2px 8px rgba(16,185,129,0.18);
            }
            .cl-add-icon { font-size: 1.1rem; font-weight: 400; }
            .cl-add-label { display: inline; }

            .cl-export-btn {
              display: inline-flex; align-items: center; gap: 7px;
              padding: 9px 16px;
              background: #fff; color: #374151;
              border: 1px solid #d1d5db; border-radius: 10px;
              cursor: pointer; font-size: 0.875rem; font-weight: 600;
              transition: background 0.15s; white-space: nowrap;
            }
            .cl-export-label { display: inline; }

            @media (max-width: 768px) {
              .cl-add-btn {
                width: 38px; height: 38px; padding: 0;
                justify-content: center; border-radius: 12px;
              }
              .cl-add-label { display: none; }

              .cl-export-btn {
                width: 38px; height: 38px; padding: 0;
                justify-content: center; border-radius: 12px;
              }
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
            onArchive={setArchiveTarget}
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

      {/* Archive confirmation modal */}
      {archiveTarget && (
        <ArchiveConfirmModal
          mode="archive"
          name={archiveTarget.businessName || archiveTarget.email}
          loading={archiving}
          onConfirm={confirmArchive}
          onClose={() => !archiving && setArchiveTarget(null)}
        />
      )}
    </div>
  );
}