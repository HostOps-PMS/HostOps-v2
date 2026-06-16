import { useState, useMemo } from 'react';
import { useStaffs } from './hooks/useStaffs';
import StaffModal from './components/StaffModal';
import StaffTable from './components/StaffTable';
import DeleteModal from '../../Staffs/components/DeleteModal';

export default function Staffs() {
  const [search, setSearch]             = useState('');
  const [modal, setModal]               = useState(null);

  // Get serverId from current user
  const user = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('hp_user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const serverId = user.serverId;

  const { staffs, loading, error, propertyMap, reload } = useStaffs(serverId);

  const filtered = (Array.isArray(staffs) ? staffs : []).filter((s) => {
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
    <>
      {/* TopBar */}
      <header className="db-topbar">
        <div className="db-topbar__search">
          <span className="db-topbar__search-icon">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="9" r="7" />
              <path d="M15 15l3 3" strokeLinecap="round" />
            </svg>
          </span>
          <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="db-topbar__actions">
          <button className="db-topbar__icon-btn" title="Notifications">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 2a6 6 0 00-6 6v3l-1.5 2H17.5L16 11V8a6 6 0 00-6-6z" />
              <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round" />
            </svg>
          </button>
          <div className="db-topbar__avatar" title="Team Leader">{user.firstName ? user.firstName[0] : 'T'}</div>
        </div>
      </header>

      <div className="cl-content">
        {/* Modals */}
        {modal?.type === 'create' && (
          <StaffModal
            mode="create"
            serverId={serverId}
            onClose={() => setModal(null)}
            onSaved={handleSaved}
          />
        )}
        {modal?.type === 'edit' && (
          <StaffModal
            mode="edit"
            staff={modal.staff}
            serverId={serverId}
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
            <h1 className="db-content__title">My Staffs</h1>
            <p className="db-content__sub">Manage your staff accounts and their property access</p>
          </div>
          <button
            onClick={() => setModal({ type: 'create' })}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: '#1555C0', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M7 1v12M1 7h12" strokeLinecap="round" />
            </svg>
            New Staff
          </button>
        </header>

        <StaffTable
          staffs={staffs}
          filtered={filtered}
          loading={loading}
          error={error}
          search={search}
          propertyMap={propertyMap}
          onSearchChange={setSearch}
          onEdit={(s) => setModal({ type: 'edit', staff: s })}
          onDelete={(s) => setModal({ type: 'delete', staff: s })}
        />
      </div>
    </>
  );
}
