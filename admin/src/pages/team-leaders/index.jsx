import { useState } from 'react';
import Sidebar from '../Sidebar';
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
          <header className="db-content__header" style={{ marginBottom: 20 }}>
            <div>
              <h1 className="db-content__title">Team Leaders</h1>
              <p className="db-content__sub">Manage team leader accounts and assignments</p>
            </div>
          </header>

          <TeamLeaderTable
            teamLeaders={teamLeaders}
            clients={clients}
            filtered={paginated}
            loading={loading}
            error={error}
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
