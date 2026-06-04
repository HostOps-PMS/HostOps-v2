import { useState } from 'react';
import Sidebar from '../Sidebar';
import { useStaffs } from './hooks/useStaffs';
import StaffModal from './components/StaffModal';
import DeleteModal from './components/DeleteModal';
import StaffTable from './components/StaffTable';

export default function Staffs() {
  const [filterClient, setFilterClient] = useState('');
  const [search, setSearch]             = useState('');
  const [modal, setModal]               = useState(null); // null | { type: 'create'|'edit'|'delete', staff? }

  const { staffs, clients, loading, error, propertyMap, reload } = useStaffs(filterClient);

  const filtered = staffs.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.firstName?.toLowerCase().includes(q) ||
      s.lastName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
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
          <header className="db-content__header">
            <div>
              <h1 className="db-content__title">Staffs</h1>
              <p className="db-content__sub">Manage staff accounts and their property access</p>
            </div>
          </header>

          <StaffTable
            staffs={staffs}
            clients={clients}
            filtered={filtered}
            loading={loading}
            error={error}
            search={search}
            filterClient={filterClient}
            propertyMap={propertyMap}
            onSearchChange={setSearch}
            onFilterClientChange={setFilterClient}
            onEdit={(s) => setModal({ type: 'edit', staff: s })}
            onDelete={(s) => setModal({ type: 'delete', staff: s })}
            onNew={() => setModal({ type: 'create' })}
          />
        </div>
      </div>
    </div>
  );
}