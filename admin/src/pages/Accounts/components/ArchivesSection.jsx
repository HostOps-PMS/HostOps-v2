import { useState, useEffect, useCallback } from 'react';
import { getClients, unarchiveClient } from '../../clients/services/clientsService';
import { fetchStaffs, unarchiveStaff } from '../../Staffs/services/staffApi';
import ArchiveConfirmModal from '../../components/ArchiveConfirmModal';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const PARENT_TAB_ICONS = {
  all:      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round"/></svg>,
  users:    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="7" r="3"/><path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeLinecap="round"/></svg>,
  staffs:   <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="7" r="3"/><path d="M1 17c0-3.314 2.686-6 6-6"/><circle cx="14" cy="7" r="3"/><path d="M13 11c3.314 0 6 2.686 6 6" strokeLinecap="round"/></svg>,
  locked:   <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="9" width="14" height="10" rx="2"/><path d="M7 9V6a3 3 0 016 0v3" strokeLinecap="round"/></svg>,
  archives: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="16" height="11" rx="1.5"/><path d="M2 6l2-3h12l2 3" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 11h4" strokeLinecap="round"/></svg>,
};

const SUB_TABS = [
  { id: 'businesses', label: 'Businesses' },
  { id: 'staffs',     label: 'Staffs' },
  { id: 'leaders',    label: 'Team Leaders' },
];

export default function ArchivesSection({ tabs = [], activeTab, onTabChange }) {
  const [subTab, setSubTab]           = useState('businesses');
  const [businesses, setBusinesses]   = useState([]);
  const [leaders, setLeaders]         = useState([]);
  const [staffs, setStaffs]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [unarchiveTarget, setUnarchiveTarget] = useState(null);
  const [unarchiving, setUnarchiving]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [clients, archivedStaffs] = await Promise.all([
        getClients({ archived: true }),
        fetchStaffs('', { archived: true }),
      ]);
      setBusinesses(clients.filter(c => c.role === 'client'));
      setLeaders(clients.filter(c => c.role === 'team_leader'));
      setStaffs(archivedStaffs);
    } catch (e) {
      setError(e.message || 'Failed to load archived records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function confirmUnarchive() {
    if (!unarchiveTarget) return;
    setUnarchiving(true);
    try {
      if (unarchiveTarget._subTab === 'staffs') {
        await unarchiveStaff(unarchiveTarget._id);
      } else {
        await unarchiveClient(unarchiveTarget._id);
      }
      load();
      setUnarchiveTarget(null);
    } catch (e) {
      console.error('[unarchive]', e);
    } finally {
      setUnarchiving(false);
    }
  }

  const counts = {
    businesses: businesses.length,
    staffs: staffs.length,
    leaders: leaders.length,
  };

  const rows =
    subTab === 'businesses' ? businesses :
    subTab === 'staffs'     ? staffs :
    leaders;

  function getName(r) {
    if (subTab === 'staffs') return `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email;
    return r.businessName || r.email;
  }

  function handleUnarchive(r) {
    setUnarchiveTarget({ ...r, _subTab: subTab });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Parent tab bar */}
      {tabs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '-1px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {tabs.map(t => {
              const active = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  onClick={() => onTabChange(t.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '9px 18px 10px', border: '1px solid',
                    borderColor: active ? '#e8ecf0' : 'transparent',
                    borderBottom: active ? '1px solid #fff' : 'none',
                    borderRadius: '10px 10px 0 0',
                    background: active ? '#fff' : 'transparent',
                    marginBottom: '-1px', cursor: 'pointer',
                    fontSize: '0.82rem', fontWeight: 600,
                    color: active ? (t.id === 'archives' ? '#f59e0b' : '#10b981') : '#9ca3af',
                    transition: 'color 0.15s', whiteSpace: 'nowrap',
                    position: 'relative', zIndex: active ? 2 : 0,
                  }}
                >
                  {PARENT_TAB_ICONS[t.id]}
                  {t.label}
                  {t.count !== null && (
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                      background: t.warn ? (active ? '#fef2f2' : 'transparent') : (active ? (t.id === 'archives' ? '#fef3c7' : '#d1fae5') : 'transparent'),
                      color: t.warn ? (active ? '#dc2626' : '#f87171') : (active ? (t.id === 'archives' ? '#92400e' : '#10b981') : '#b0b7c3'),
                    }}>
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Content box */}
      <div style={{
        background: '#fff', borderRadius: '0 12px 12px 12px',
        border: '1px solid #e8ecf0', paddingBottom: 4,
      }}>

        {/* Sub-tab bar inside the box */}
        <div style={{ borderBottom: '1px solid #f0f2f5', padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, paddingTop: 12 }}>
            {SUB_TABS.map(t => {
              const active = subTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSubTab(t.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 16px 10px',
                    border: 'none', borderBottom: active ? '2px solid #f59e0b' : '2px solid transparent',
                    background: 'transparent', cursor: 'pointer',
                    fontSize: '0.82rem', fontWeight: active ? 700 : 500,
                    color: active ? '#92400e' : '#9ca3af',
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                    background: active ? '#fef3c7' : '#f3f4f6',
                    color: active ? '#92400e' : '#9ca3af',
                  }}>
                    {loading ? '…' : counts[t.id]}
                  </span>
                </button>
              );
            })}

            {/* Refresh button pushed to the right */}
            <div style={{ marginLeft: 'auto', paddingBottom: 4 }}>
              <button
                onClick={load}
                disabled={loading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 8,
                  border: '1px solid #e5e7eb', background: '#fff',
                  fontSize: '0.78rem', fontWeight: 600, color: '#374151',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ animation: loading ? 'ac-archive-spin 0.8s linear infinite' : 'none' }}>
                  <path d="M4 4a8 8 0 0112 0M16 16a8 8 0 01-12 0" strokeLinecap="round"/>
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        <style>{`@keyframes ac-archive-spin { to { transform: rotate(360deg); } }`}</style>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '12px 16px', margin: '12px 16px 0', fontSize: '0.875rem' }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#a0aec0', fontSize: '0.875rem' }}>
            Loading archived records…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#a0aec0', fontSize: '0.875rem' }}>
            No archived {SUB_TABS.find(t => t.id === subTab)?.label.toLowerCase()}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f2f5' }}>
                  {['Name', 'Email', 'Archived On', ''].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af',
                      letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r._id}
                    style={{
                      borderBottom: i < rows.length - 1 ? '1px solid #f7f8fa' : 'none',
                      background: 'transparent', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fffbeb'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                        {getName(r)}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.83rem', color: '#6b7280' }}>
                      {r.email}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {formatDate(r.updatedAt)}
                    </td>
                    <td style={{ padding: '12px 16px 12px 8px', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => handleUnarchive(r)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '5px 12px', borderRadius: 6,
                          border: '1px solid #10b981', background: '#f0fdf4',
                          fontSize: '0.78rem', fontWeight: 600, color: '#059669',
                          cursor: 'pointer',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="6" width="16" height="11" rx="1.5"/>
                          <path d="M2 6l2-3h12l2 3" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M8 11h4M10 9v4" strokeLinecap="round"/>
                        </svg>
                        Unarchive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {unarchiveTarget && (
        <ArchiveConfirmModal
          mode="unarchive"
          name={getName(unarchiveTarget)}
          loading={unarchiving}
          onConfirm={confirmUnarchive}
          onClose={() => !unarchiving && setUnarchiveTarget(null)}
        />
      )}
    </div>
  );
}
