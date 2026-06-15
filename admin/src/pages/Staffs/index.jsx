import { useState } from 'react';
import Sidebar from '../Sidebar';
import TopBar from '../dashboard/components/TopBar';
import { useStaffs } from './hooks/useStaffs';
import StaffModal from './components/StaffModal';
import DeleteModal from './components/DeleteModal';
import StaffTable from './components/StaffTable';
import { exportStaffsPdf } from './utils/exportStaffsPdf';
import { archiveStaff } from './services/staffApi';
import { toast } from '../../utils/toast';
import ArchiveConfirmModal from '../components/ArchiveConfirmModal';

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

  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving]         = useState(false);

  async function confirmArchiveStaff() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await archiveStaff(archiveTarget._id);
      const name = `${archiveTarget.firstName || ''} ${archiveTarget.lastName || ''}`.trim() || archiveTarget.email;
      toast.success(`${name} has been archived.`, { title: 'Staff Archived' });
      reload();
      setArchiveTarget(null);
    } catch (err) {
      toast.error('Failed to archive staff. Please try again.', { title: 'Archive Failed' });
      console.error('[archiveStaff]', err);
    } finally {
      setArchiving(false);
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* New Staff button */}
              <button
                onClick={() => setModal({ type: 'create' })}
                className="st-add-btn"
                onMouseEnter={e => { e.currentTarget.style.background = '#059669'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#10b981'; }}
                title="New Staff"
              >
                <span className="st-add-icon">+</span>
                <span className="st-add-label">New Staff</span>
              </button>

              <button
                onClick={handleExport}
                disabled={exportLoading || loading}
                className="st-export-btn"
                style={{
                  background: (exportLoading || loading) ? '#f3f4f6' : undefined,
                  color: (exportLoading || loading) ? '#aaa' : undefined,
                  border: (exportLoading || loading) ? '1px solid #e5e7eb' : undefined,
                  cursor: (exportLoading || loading) ? 'not-allowed' : undefined,
                  opacity: (exportLoading || loading) ? 0.7 : 1,
                }}
                onMouseEnter={e => { if (!exportLoading && !loading) e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={e => { if (!exportLoading && !loading) e.currentTarget.style.background = '#fff'; }}
                title="Export visible staffs as PDF"
              >
                {exportLoading ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                    style={{ animation: 'st-pdf-spin 0.8s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 16h14" strokeLinecap="round" />
                  </svg>
                )}
                <span className="st-export-label">{exportLoading ? 'Exporting…' : 'Export PDF'}</span>
              </button>
            </div>
            <style>{`
            @keyframes st-pdf-spin { to { transform: rotate(360deg); } }

            .st-add-btn {
              display: inline-flex; align-items: center; gap: 7px;
              padding: 9px 16px;
              background: #10b981; color: #fff;
              border: none; border-radius: 10px;
              cursor: pointer; font-size: 0.875rem; font-weight: 600;
              transition: background 0.15s; white-space: nowrap;
              box-shadow: 0 2px 8px rgba(16,185,129,0.18);
            }
            .st-add-icon { font-size: 1.1rem; font-weight: 400; }
            .st-add-label { display: inline; }

            .st-export-btn {
              display: inline-flex; align-items: center; gap: 7px;
              padding: 9px 16px;
              background: #fff; color: #374151;
              border: 1px solid #d1d5db; border-radius: 10px;
              cursor: pointer; font-size: 0.875rem; font-weight: 600;
              transition: background 0.15s; white-space: nowrap;
            }
            .st-export-label { display: inline; }

            @media (max-width: 768px) {
              .st-add-btn {
                width: 38px; height: 38px; padding: 0;
                justify-content: center; border-radius: 12px;
                box-shadow: none;
              }
              .st-add-label { display: none; }

              .st-export-btn {
                width: 38px; height: 38px; padding: 0;
                justify-content: center; border-radius: 12px;
              }
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
          name={`${archiveTarget.firstName || ''} ${archiveTarget.lastName || ''}`.trim() || archiveTarget.email}
          loading={archiving}
          onConfirm={confirmArchiveStaff}
          onClose={() => !archiving && setArchiveTarget(null)}
        />
      )}
    </div>
  );
}