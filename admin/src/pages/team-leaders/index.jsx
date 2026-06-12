import { useState } from 'react';
import Sidebar from '../Sidebar';
import TopBar from '../dashboard/components/TopBar';
import { useStats } from '../dashboard/hooks/useStats';
import { useTeamLeaders } from './hooks/useTeamLeaders';
import TeamLeaderModal from './components/TeamLeaderModal';
import DeleteModal from './components/DeleteModal';
import TeamLeaderTable from './components/TeamLeaderTable';

export default function TeamLeaders() {
  const [search, setSearch]             = useState('');
  const [page,   setPage]               = useState(1);
  const PAGE_SIZE = 10;
  const [modal, setModal]               = useState(null); // null | { type: 'create'|'edit'|'delete', teamLeader? }

  const { teamLeaders, clients, loading, error, refetch } = useTeamLeaders();

  /* ── Alerts + Activity from dashboard overview (same source as Dashboard/Clients/Staffs) ── */
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
        {/* TopBar — same component as Dashboard/Clients/Staffs, fed with live alerts + activities.
            No onExport/showExport passed, so the Export PDF button stays hidden here. */}
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