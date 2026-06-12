import { useState } from 'react';
import Sidebar from '../Sidebar';
import TopBar from '../dashboard/components/TopBar';
import { useStaffs } from './hooks/useStaffs';
import StaffModal from './components/StaffModal';
import DeleteModal from './components/DeleteModal';
import StaffTable from './components/StaffTable';
import { exportStaffsPdf } from './utils/exportStaffsPdf';
import { archiveStaff } from './services/staffApi';

export default function Staffs() {
  const [filterClient, setFilterClient] = useState('');
  const [search, setSearch]             = useState('');
  const [page,   setPage]               = useState(1);
  const PAGE_SIZE = 10;
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearchChange(val) {
    setSearch(val);
    setPage(1);
  }

  const [exportLoading, setExportLoading] = useState(false);

  async function handleExport() {
    if (exportLoading || loading) return;
    setExportLoading(true);
    try {
      await exportStaffsPdf({ staffs: filtered, clients, propertyMap, filterClient, search });
    } finally {
      setExportLoading(false);
    }
  }

  function handleSaved() {
    setModal(null);
    reload();
  }

  function handleDeleted() {
    setModal(null);
    reload();
  }

  async function handleArchiveStaff(staff) {
    try {
      await archiveStaff(staff._id);
      reload();
    } catch (err) {
      console.error('[archiveStaff]', err);
    }
  }

  return (
    <div className="db-layout">
      <Sidebar />

      <div className="db-main">
        {/* TopBar — same component as Dashboard/Clients, fed with live alerts + activities.
            No onExport/showExport passed, so the Export PDF button stays hidden here. */}
        <TopBar />

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
              title="Export visible staffs as PDF"
            >
              {exportLoading ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                  style={{ animation: 'st-pdf-spin 0.8s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 16h14" strokeLinecap="round" />
                </svg>
              )}
              <span className="st-export-label">{exportLoading ? 'Exporting…' : 'Export PDF'}</span>
            </button>
            <style>{`
            @keyframes st-pdf-spin { to { transform: rotate(360deg); } }
            @media (max-width: 768px) {
              .st-export-label { display: none; }
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
            onArchive={handleArchiveStaff}
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