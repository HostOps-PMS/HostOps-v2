import { useState } from 'react';
import Sidebar from '../Sidebar';
import TopBar from '../dashboard/components/TopBar';
import { useStats } from '../dashboard/hooks/useStats';
import { useTeamLeaders } from './hooks/useTeamLeaders';
import TeamLeaderModal from './components/TeamLeaderModal';
import DeleteModal from './components/DeleteModal';
import TeamLeaderTable from './components/TeamLeaderTable';
import { exportTeamLeadersPdf } from './utils/exportTeamLeadersPdf';

export default function TeamLeaders() {
  const [search, setSearch]             = useState('');
  const [page,   setPage]               = useState(1);
  const PAGE_SIZE = 10;
  const [modal, setModal]               = useState(null); // null | { type: 'create'|'edit'|'delete', teamLeader? }

  const { teamLeaders, clients, loading, error, refetch } = useTeamLeaders();

  /* ── Alerts + Activity from dashboard overview ── */
  const { overview, loading: notifLoading } = useStats();

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

  return (
    <div className="db-layout">
      <Sidebar />

      <div className="db-main">
        <TopBar
          alerts={overview?.alerts ?? []}
          activities={overview?.recentActivities ?? []}
          notifLoading={notifLoading}
        />

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

            {/* Export PDF button */}
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
              title="Export all team leaders as PDF"
            >
              {exportBtnIcon}
              {exportLoading ? 'Exporting…' : 'Export PDF'}
            </button>
            <style>{`@keyframes tl-pdf-spin { to { transform: rotate(360deg); } }`}</style>
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
            onNew={() => setModal({ type: 'create' })}
            page={page}
            totalPages={totalPages}
            totalCount={filtered.length}
            onPrev={() => setPage(p => Math.max(1, p - 1))}
            onNext={() => setPage(p => Math.min(totalPages, p + 1))}
          />
        </div>
      </div>
    </div>
  );
}
