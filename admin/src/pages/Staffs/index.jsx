import { useState } from 'react';
import Sidebar from '../Sidebar';
import TopBar from '../dashboard/components/TopBar';
import { useStats } from '../dashboard/hooks/useStats';
import { useStaffs } from './hooks/useStaffs';
import StaffModal from './components/StaffModal';
import DeleteModal from './components/DeleteModal';
import StaffTable from './components/StaffTable';

export default function Staffs() {
  const [filterClient, setFilterClient] = useState('');
  const [search, setSearch]             = useState('');
  const [page,   setPage]               = useState(1);
  const PAGE_SIZE = 10;
  const [modal, setModal]               = useState(null); // null | { type: 'create'|'edit'|'delete', staff? }

  const { staffs, clients, loading, error, propertyMap, reload } = useStaffs(filterClient);

  /* ── Alerts + Activity from dashboard overview (same source as Dashboard/Clients) ── */
  const { overview, loading: notifLoading } = useStats();

  const filtered = staffs.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.firstName?.toLowerCase().includes(q) ||
      s.lastName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
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
        {/* TopBar — same component as Dashboard/Clients, fed with live alerts + activities.
            No onExport/showExport passed, so the Export PDF button stays hidden here. */}
        <TopBar
          alerts={overview?.alerts ?? []}
          activities={overview?.recentActivities ?? []}
          notifLoading={notifLoading}
        />

        <div className="cl-content">
          {/* Modals */}
          {modal?.type === 'create' && (
            <StaffModal
              mode="create"
              clients={clients}
              onClose={() => setModal(null)}
              onSaved={handleSaved}
            />
          )}
          {modal?.type === 'edit' && (
            <StaffModal
              mode="edit"
              staff={modal.staff}
              clients={clients}
              onClose={() => setModal(null)}
              onSaved={handleSaved}
            />
          )}
          {modal?.type === 'delete' && (
            <DeleteModal
              staff={modal.staff}
              onClose={() => setModal(null)}
              onDeleted={handleDeleted}
            />
          )}

          {/* Page Header */}
          <header className="cl-content__header">
            <div>
              <h1 className="cl-content__title">Staffs</h1>
              <p className="cl-content__sub">Manage staff accounts and their property access</p>
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

          <StaffTable
            staffs={staffs}
            clients={clients}
            filtered={paginated}
            loading={loading}
            error={null}
            search={search}
            filterClient={filterClient}
            propertyMap={propertyMap}
            onSearchChange={handleSearchChange}
            onFilterClientChange={(val) => { setFilterClient(val); setPage(1); }}
            onEdit={(s) => setModal({ type: 'edit', staff: s })}
            onDelete={(s) => setModal({ type: 'delete', staff: s })}
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