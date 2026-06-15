import { useState } from 'react';
import Sidebar from '../Sidebar';
import TopBar from '../dashboard/components/TopBar';
import { useTeamLeaders } from './hooks/useTeamLeaders';
import TeamLeaderModal from './components/TeamLeaderModal';
import DeleteModal from './components/DeleteModal';
import TeamLeaderTable from './components/TeamLeaderTable';
import { exportTeamLeadersPdf } from './utils/exportTeamLeadersPdf';
import { archiveClient } from '../clients/services/clientsService';
import { toast } from '../../utils/toast';
import ArchiveConfirmModal from '../components/ArchiveConfirmModal';

export default function TeamLeaders() {
  const [search, setSearch]             = useState('');
  const [page,   setPage]               = useState(1);
  const PAGE_SIZE = 10;
  const [modal, setModal]               = useState(null); // null | { type: 'create'|'edit'|'delete', teamLeader? }

  const { teamLeaders, clients, loading, error, refetch } = useTeamLeaders();

  const filtered = teamLeaders.filter((tl) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      tl.firstName?.toLowerCase().includes(q) ||
      tl.lastName?.toLowerCase().includes(q) ||
      tl.email?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearchChange(val) {
    setSearch(val);
    setPage(1);
  }

  /* ── Export PDF — exports all filtered records, not just current page ── */
  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async () => {
    if (exportLoading || loading) return;
    setExportLoading(true);
    try {
      await exportTeamLeadersPdf({ teamLeaders: filtered, clients, search });
    } catch (err) {
      console.error('[exportTeamLeadersPdf] failed:', err);
    } finally {
      setExportLoading(false);
    }
  };

  const exportBtnIcon = exportLoading ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      style={{ animation: 'tl-pdf-spin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 16h14" strokeLinecap="round" />
    </svg>
  );

  function handleSaved() {
    setModal(null);
    refetch();
  }

  function handleDeleted() {
    setModal(null);
    refetch();
  }

  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving]         = useState(false);

  async function confirmArchiveTeamLeader() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await archiveClient(archiveTarget._id);
      const name = archiveTarget.businessName || `${archiveTarget.firstName || ''} ${archiveTarget.lastName || ''}`.trim() || archiveTarget.email;
      toast.success(`${name} has been archived.`, { title: 'Team Leader Archived' });
      refetch();
      setArchiveTarget(null);
    } catch (err) {
      toast.error('Failed to archive team leader. Please try again.', { title: 'Archive Failed' });
      console.error('[archiveTeamLeader]', err);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="db-layout">
      <Sidebar />

      <div className="db-main">
        <TopBar />

        <div className="cl-content">
          {/* Modals */}
          {modal?.type === 'create' && (
            <TeamLeaderModal
              mode="create"
              clients={clients}
              onClose={() => setModal(null)}
              onSaved={handleSaved}
            />
          )}
          {modal?.type === 'edit' && (
            <TeamLeaderModal
              mode="edit"
              teamLeader={modal.teamLeader}
              clients={clients}
              onClose={() => setModal(null)}
              onSaved={handleSaved}
            />
          )}
          {modal?.type === 'delete' && (
            <DeleteModal
              teamLeader={modal.teamLeader}
              onClose={() => setModal(null)}
              onDeleted={handleDeleted}
            />
          )}

          {/* Page Header */}
          <header className="cl-content__header" style={{ marginBottom: 20 }}>
            <div>
              <h1 className="cl-content__title">Team Leaders</h1>
              <p className="cl-content__sub">Manage team leader accounts and assignments</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* New Team Leader button */}
              <button
                onClick={() => setModal({ type: 'create' })}
                className="tl-add-btn"
                onMouseEnter={e => { e.currentTarget.style.background = '#059669'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#10b981'; }}
                title="New Team Leader"
              >
                <span className="tl-add-icon">+</span>
                <span className="tl-add-label">New Team Leader</span>
              </button>

              {/* Export PDF button */}
              <button
                onClick={handleExport}
                disabled={exportLoading || loading}
                className="tl-export-btn"
                style={{
                  background: (exportLoading || loading) ? '#f3f4f6' : undefined,
                  color: (exportLoading || loading) ? '#aaa' : undefined,
                  border: (exportLoading || loading) ? '1px solid #e5e7eb' : undefined,
                  cursor: (exportLoading || loading) ? 'not-allowed' : undefined,
                  opacity: (exportLoading || loading) ? 0.7 : 1,
                }}
                onMouseEnter={e => { if (!exportLoading && !loading) e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={e => { if (!exportLoading && !loading) e.currentTarget.style.background = '#fff'; }}
                title="Export all team leaders as PDF"
              >
                {exportBtnIcon}
                <span className="tl-export-label">{exportLoading ? 'Exporting…' : 'Export PDF'}</span>
              </button>
            </div>
            <style>{`
              @keyframes tl-pdf-spin { to { transform: rotate(360deg); } }

              .tl-add-btn {
                display: inline-flex; align-items: center; gap: 7px;
                padding: 9px 16px;
                background: #10b981; color: #fff;
                border: none; border-radius: 10px;
                cursor: pointer; font-size: 0.875rem; font-weight: 600;
                transition: background 0.15s; white-space: nowrap;
                box-shadow: 0 2px 8px rgba(16,185,129,0.18);
              }
              .tl-add-icon { font-size: 1.1rem; font-weight: 400; }
              .tl-add-label { display: inline; }

              .tl-export-btn {
                display: inline-flex; align-items: center; gap: 7px;
                padding: 9px 16px;
                background: #fff; color: #374151;
                border: 1px solid #d1d5db; border-radius: 10px;
                cursor: pointer; font-size: 0.875rem; font-weight: 600;
                transition: background 0.15s; white-space: nowrap;
              }
              .tl-export-label { display: inline; }

              @media (max-width: 768px) {
                .tl-add-btn {
                  width: 38px; height: 38px; padding: 0;
                  justify-content: center; border-radius: 12px;
                  box-shadow: none;
                }
                .tl-add-label { display: none; }

                .tl-export-btn {
                  width: 38px; height: 38px; padding: 0;
                  justify-content: center; border-radius: 12px;
                }
                .tl-export-label { display: none; }
              }
            `}</style>
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

          <TeamLeaderTable
            teamLeaders={teamLeaders}
            clients={clients}
            filtered={paginated}
            loading={loading}
            error={null}
            search={search}
            onSearchChange={handleSearchChange}
            onEdit={(tl) => setModal({ type: 'edit', teamLeader: tl })}
            onDelete={(tl) => setModal({ type: 'delete', teamLeader: tl })}
            onArchive={setArchiveTarget}
            onNew={() => setModal({ type: 'create' })}
            page={page}
            totalPages={totalPages}
            totalCount={filtered.length}
            onPrev={() => setPage(p => Math.max(1, p - 1))}
            onNext={() => setPage(p => Math.min(totalPages, p + 1))}
          />
        </div>
      </div>

      {archiveTarget && (
        <ArchiveConfirmModal
          mode="archive"
          name={archiveTarget.businessName || archiveTarget.email}
          loading={archiving}
          onConfirm={confirmArchiveTeamLeader}
          onClose={() => !archiving && setArchiveTarget(null)}
        />
      )}
    </div>
  );
}
