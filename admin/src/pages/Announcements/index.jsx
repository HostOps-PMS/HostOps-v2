import { useState, useMemo } from 'react';
import '../clients/clients.css';

import Sidebar              from '../Sidebar';
import TopBar               from '../dashboard/components/TopBar';
import AnnouncementsTable   from './components/AnnouncementsTable';
import AnnouncementModal    from './components/AnnouncementModal';
import ArchivesTable        from './components/ArchivesTable';
import { useAnnouncements } from './hooks/useAnnouncements';
import { createAnnouncement, updateAnnouncement } from './services/announcementsService';
import { toast } from '../../utils/toast';
import ArchiveConfirmModal  from '../components/ArchiveConfirmModal';

export default function Announcements() {
  const { announcements, loading, error, refetch } = useAnnouncements();

  /* ── View toggle: announcements vs archives ── */
  const [view, setView] = useState('announcements');

  /* ── Search / pagination ── */
  const [search, setSearch] = useState('');
  const [page,   setPage]   = useState(1);
  const PAGE_SIZE = 10;

  const active   = useMemo(() => (announcements || []).filter(a => a.status !== 'archived'), [announcements]);
  const archived = useMemo(() => (announcements || []).filter(a => a.status === 'archived'), [announcements]);

  const filtered = useMemo(() => {
    const list = view === 'archives' ? archived : active;
    const q = search.trim().toLowerCase();
    return list.filter((a) =>
      !q ||
      (a.title   && a.title.toLowerCase().includes(q)) ||
      (a.content && a.content.toLowerCase().includes(q))
    );
  }, [active, archived, view, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearchChange(val) { setSearch(val); setPage(1); }
  function handleViewChange(v) { setView(v); setSearch(''); setPage(1); }

  /* ── Create / Edit modal ── */
  const [modalItem, setModalItem]     = useState(null);
  const [showCreate, setShowCreate]   = useState(false);

  async function handleSave(data, imageFile) {
    try {
      if (modalItem?._id) {
        await updateAnnouncement(modalItem._id, data, imageFile);
        toast.success('Announcement updated.', { title: 'Updated' });
      } else {
        await createAnnouncement(data, imageFile);
        toast.success('Announcement created.', { title: 'Created' });
      }
      setModalItem(null);
      setShowCreate(false);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to save announcement.', { title: 'Error' });
    }
  }

  /* ── Archive confirm ── */
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving]         = useState(false);

  async function confirmArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await updateAnnouncement(archiveTarget._id, { status: 'archived' });
      toast.success(`"${archiveTarget.title}" has been archived.`, { title: 'Archived' });
      refetch();
      setArchiveTarget(null);
    } catch {
      toast.error('Failed to archive announcement.', { title: 'Archive Failed' });
    } finally {
      setArchiving(false);
    }
  }

  /* ── Restore confirm ── */
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring]         = useState(false);

  async function confirmRestore() {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      await updateAnnouncement(restoreTarget._id, { status: 'draft' });
      toast.success(`"${restoreTarget.title}" has been restored.`, { title: 'Restored' });
      refetch();
      setRestoreTarget(null);
    } catch {
      toast.error('Failed to restore announcement.', { title: 'Restore Failed' });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="db-layout">
      <Sidebar />

      <div className="db-main">
        <TopBar />

        <div className="cl-content">
          <style>{`
            @keyframes ann-view-enter { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
            @media (max-width: 768px) { .ann-view-label { display: none; } }
          `}</style>

          <header className="cl-content__header">
            <div>
              <h1 className="cl-content__title">Announcements</h1>
              <p className="cl-content__sub">Manage announcements for your users</p>
            </div>

            {view === 'announcements' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => { setModalItem({}); setShowCreate(true); }}
                  className="cl-add-btn"
                  onMouseEnter={e => { e.currentTarget.style.background = '#059669'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#10b981'; }}
                  title="New Announcement"
                >
                  <span className="cl-add-icon">+</span>
                  <span className="cl-add-label">New Announcement</span>
                </button>
              </div>
            )}

            <style>{`
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
              @media (max-width: 768px) {
                .cl-add-btn { width: 38px; height: 38px; padding: 0; justify-content: center; border-radius: 12px; }
                .cl-add-label { display: none; }
              }
            `}</style>
          </header>

          {error && (
            <div style={{
              background: '#fee2e2', color: '#b91c1c',
              borderRadius: 'var(--radius-sm)', padding: '12px 16px',
              fontSize: '.875rem', fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <div key={view} style={{ animation: 'ann-view-enter 0.2s cubic-bezier(0.4,0,0.2,1)' }}>
            {view === 'archives' ? (
              <ArchivesTable
                announcements={paginated}
                loading={loading}
                search={search}
                onSearchChange={handleSearchChange}
                onRefresh={refetch}
                onRestore={setRestoreTarget}
                onRowClick={(item) => setModalItem(item)}
                view={view}
                onViewChange={handleViewChange}
                page={page}
                totalPages={totalPages}
                totalCount={filtered.length}
                onPrev={() => setPage(p => Math.max(1, p - 1))}
                onNext={() => setPage(p => Math.min(totalPages, p + 1))}
              />
            ) : (
              <AnnouncementsTable
                announcements={paginated}
                loading={loading}
                onRowClick={(item) => setModalItem(item)}
                search={search}
                onSearchChange={handleSearchChange}
                onRefresh={refetch}
                onArchive={setArchiveTarget}
                view={view}
                onViewChange={handleViewChange}
                page={page}
                totalPages={totalPages}
                totalCount={filtered.length}
                onPrev={() => setPage(p => Math.max(1, p - 1))}
                onNext={() => setPage(p => Math.min(totalPages, p + 1))}
              />
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit modal */}
      {(modalItem || showCreate) && (
        <AnnouncementModal
          announcement={modalItem?._id ? modalItem : null}
          onClose={() => { setModalItem(null); setShowCreate(false); }}
          onSave={handleSave}
        />
      )}

      {/* Archive confirmation */}
      {archiveTarget && (
        <ArchiveConfirmModal
          mode="archive"
          name={archiveTarget.title}
          loading={archiving}
          onConfirm={confirmArchive}
          onClose={() => !archiving && setArchiveTarget(null)}
        />
      )}

      {/* Restore confirmation */}
      {restoreTarget && (
        <ArchiveConfirmModal
          mode="restore"
          name={restoreTarget.title}
          loading={restoring}
          onConfirm={confirmRestore}
          onClose={() => !restoring && setRestoreTarget(null)}
        />
      )}
    </div>
  );
}
