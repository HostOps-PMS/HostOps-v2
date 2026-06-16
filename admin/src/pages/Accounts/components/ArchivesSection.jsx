import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { getClients, unarchiveClient } from '../../clients/services/clientsService';
import { fetchStaffs, unarchiveStaff } from '../../Staffs/services/staffApi';
import { fetchDisabledAppeals, resolveAppeal } from '../services/recoveryRequestsApi';
import ArchiveConfirmModal from '../../components/ArchiveConfirmModal';
import { toast } from '../utils/toast';

/* ── shared helpers ── */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── view toggle (same as in AccountsTable) ── */
const VIEW_OPTS = [
  { id: 'accounts', label: 'Accounts', icon: <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="7" r="3"/><path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeLinecap="round"/></svg> },
  { id: 'archives', label: 'Archives',  icon: <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="16" height="11" rx="1.5"/><path d="M2 6l2-3h12l2 3" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 11h4" strokeLinecap="round"/></svg> },
];

function ViewToggle({ view, onViewChange }) {
  const { dark } = useTheme();
  return (
    <div style={{ display: 'inline-flex', background: dark ? '#0d2619' : '#eef0f3', borderRadius: 8, padding: 3, flexShrink: 0 }}>
      {VIEW_OPTS.map(v => {
        const active = view === v.id;
        return (
          <button key={v.id} onClick={() => onViewChange(v.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 6, border: 'none', background: active ? (dark ? '#132a1e' : '#fff') : 'transparent', color: active ? (v.id === 'archives' ? (dark ? '#fbbf24' : '#92400e') : (dark ? '#4ade80' : '#065f46')) : (dark ? '#4d8a6a' : '#6b7280'), fontWeight: active ? 700 : 500, fontSize: '0.76rem', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: active ? '0 1px 5px rgba(0,0,0,0.10)' : 'none', transition: 'all 0.16s ease' }}
          >
            <span style={{ color: active ? (v.id === 'archives' ? '#f59e0b' : '#10b981') : '#b0b7c3', display: 'flex', transition: 'color 0.16s' }}>{v.icon}</span>
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── role / type badges ── */
const TYPE_BADGE = {
  businesses: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'Business' },
  staffs:     { bg: '#f9fafb', color: '#374151', border: '#e5e7eb', label: 'Staff' },
  leaders:    { bg: '#f0fdf4', color: '#15803d', border: '#86efac', label: 'Team Leader' },
};

function TypeBadge({ subTab }) {
  const { dark } = useTheme();
  const s = TYPE_BADGE[subTab] || TYPE_BADGE.businesses;
  return (
    <span style={{ background: dark ? '#0d2619' : s.bg, color: dark ? '#7ab89a' : s.color, border: `1px solid ${dark ? '#1e3a2a' : s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

/* ── sub-tabs config ── */
const SUB_TABS = [
  { id: 'all',        label: 'All' },
  { id: 'businesses', label: 'Businesses' },
  { id: 'staffs',     label: 'Staffs' },
  { id: 'leaders',    label: 'Team Leaders' },
];

const SUB_TAB_LABELS = {
  all:        'accounts',
  businesses: 'businesses',
  staffs:     'staffs',
  leaders:    'team leaders',
};

/* ══════════════════════════════════════════════════════════ */
export default function ArchivesSection({ view, onViewChange, onRowsChange }) {
  const { dark } = useTheme();
  const [subTab,    setSubTab]    = useState('all');
  const [businesses, setBusinesses] = useState([]);
  const [leaders,    setLeaders]    = useState([]);
  const [staffs,     setStaffs]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [unarchiveTarget, setUnarchiveTarget] = useState(null);
  const [unarchiving,     setUnarchiving]     = useState(false);
  const [appeals,         setAppeals]         = useState([]);
  const [expandedAppeal,  setExpandedAppeal]  = useState(null);
  const [appealAction,    setAppealAction]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [clients, archivedStaffs, pendingAppeals] = await Promise.all([
        getClients({ archived: true }),
        fetchStaffs('', { archived: true }),
        fetchDisabledAppeals().catch(() => []),
      ]);
      setBusinesses(clients.filter(c => c.role === 'client'));
      setLeaders(clients.filter(c => c.role === 'team_leader'));
      setStaffs(archivedStaffs);
      setAppeals(pendingAppeals);
    } catch (e) {
      setError(e.message || 'Failed to load archived records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function getName(r) {
    const type = r._type || subTab;
    if (type === 'staffs') return `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email;
    return r.businessName || r.email;
  }

  async function confirmUnarchive() {
    if (!unarchiveTarget) return;
    setUnarchiving(true);
    try {
      if (unarchiveTarget._subTab === 'staffs') await unarchiveStaff(unarchiveTarget._id);
      else                                       await unarchiveClient(unarchiveTarget._id);
      toast.success(`${getName(unarchiveTarget)} has been restored successfully.`, { title: 'Account Restored' });
      load(); setUnarchiveTarget(null);
    } catch (e) {
      toast.error('Failed to restore account. Please try again.', { title: 'Restore Failed' });
    } finally {
      setUnarchiving(false);
    }
  }

  async function handleAppealAction(appeal, action) {
    setAppealAction(appeal._id);
    try {
      await resolveAppeal(appeal._id, { status: action === 'approve' ? 'resolved' : 'dismissed', enableAccount: action === 'approve' });
      if (action === 'approve') toast.success('Appeal approved — account has been re-enabled.', { title: 'Appeal Approved' });
      else                      toast.info('Appeal dismissed.', { title: 'Appeal Dismissed' });
      load(); setExpandedAppeal(null);
    } catch (e) {
      toast.error('Failed to resolve appeal. Please try again.', { title: 'Action Failed' });
    } finally {
      setAppealAction(null);
    }
  }

const appealsByEmail = Object.fromEntries((Array.isArray(appeals) ? appeals : []).map(a => [a.email, a]));
  const total  = businesses.length + staffs.length + leaders.length;
  const counts = { all: total, businesses: businesses.length, staffs: staffs.length, leaders: leaders.length };

  const allRows = [
    ...businesses.map(r => ({ ...r, _type: 'businesses' })),
    ...staffs.map(r => ({ ...r, _type: 'staffs' })),
    ...leaders.map(r => ({ ...r, _type: 'leaders' })),
  ];
  const rows = subTab === 'all' ? allRows
    : subTab === 'businesses' ? businesses
    : subTab === 'staffs'     ? staffs
    : leaders;

  const onRowsChangeRef = useRef(onRowsChange);
  onRowsChangeRef.current = onRowsChange;
  useEffect(() => {
    onRowsChangeRef.current?.(rows, subTab);
  }, [rows, subTab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes ac-arc-spin    { to { transform: rotate(360deg); } }
        @keyframes ac-arc-shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        .ac-arc-sk { background: linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%); background-size:1200px 100%; animation:ac-arc-shimmer 1.5s ease-in-out infinite; border-radius:5px; }
      `}</style>

      {/* ── Sub-tab bar — ABOVE the white box, same structure as AccountsTable's TabBar ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        {/* scrollable sub-tabs */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'flex-end', overflowX: 'auto', marginBottom: '-1px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {SUB_TABS.map(t => {
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '9px 18px 10px',
                  border: '1px solid',
                  borderColor: active ? (dark ? '#1e3a2a' : '#e8ecf0') : 'transparent',
                  borderBottom: active ? `1px solid ${dark ? '#132a1e' : '#fff'}` : 'none',
                  borderRadius: '10px 10px 0 0',
                  background: active ? (dark ? '#132a1e' : '#fff') : 'transparent',
                  marginBottom: '-1px',
                  cursor: 'pointer',
                  fontSize: '0.82rem', fontWeight: 600,
                  color: active ? '#d97706' : (dark ? '#4d8a6a' : '#9ca3af'),
                  transition: 'color 0.15s', whiteSpace: 'nowrap',
                  position: 'relative', zIndex: active ? 2 : 0,
                }}
              >
                {t.label}
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                  background: active ? (dark ? '#2a1f00' : '#fef3c7') : 'transparent',
                  color: active ? (dark ? '#fbbf24' : '#92400e') : (dark ? '#4d8a6a' : '#b0b7c3'),
                }}>
                  {loading ? '…' : counts[t.id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Toggle — right side of the tab row */}
        <div style={{ paddingBottom: 6, paddingLeft: 10, flexShrink: 0 }}>
          <ViewToggle view={view} onViewChange={onViewChange} />
        </div>
      </div>

      {/* ── White box — same style as AccountsTable ── */}
      <div style={{ background: dark ? '#132a1e' : '#fff', borderRadius: '0 12px 12px 12px', border: `1px solid ${dark ? '#1e3a2a' : '#e8ecf0'}`, paddingBottom: 4 }}>

        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 12px', borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}` }}>
          <span style={{ fontSize: '0.76rem', color: dark ? '#4d8a6a' : '#9ca3af', whiteSpace: 'nowrap' }}>
            {loading ? '…' : rows.length} archived {SUB_TAB_LABELS[subTab] || subTab}
          </span>
          <button
            onClick={load} disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 7, border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`, background: dark ? '#0d2619' : '#fff', color: dark ? '#7ab89a' : '#374151', fontSize: '0.78rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s', marginLeft: 'auto', flexShrink: 0 }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = dark ? '#132a1e' : '#f9fafb'; }}
            onMouseLeave={e => e.currentTarget.style.background = dark ? '#0d2619' : '#fff'}
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: loading ? 'ac-arc-spin 0.8s linear infinite' : 'none' }}>
              <path d="M4 4a8 8 0 0112 0M16 16a8 8 0 01-12 0" strokeLinecap="round"/>
              <path d="M20 4l-4 0 0 4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M0 16l4 0 0-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Refresh
          </button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: '0.83rem', fontWeight: 500, margin: '10px 14px 0' }}>⚠️ {error}</div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: i < 4 ? `1px solid ${dark ? '#1e3a2a' : '#f7f8fa'}` : 'none' }}>
                    <td style={{ padding: '13px 16px 13px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="ac-arc-sk" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0 }} />
                        <div>
                          <div className="ac-arc-sk" style={{ width: 100 + (i % 3) * 24, height: 12, marginBottom: 6 }} />
                          <div className="ac-arc-sk" style={{ width: 140 + (i % 2) * 28, height: 10 }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px' }}><div className="ac-arc-sk" style={{ width: 68, height: 20 }} /></td>
                    <td style={{ padding: '13px 16px' }}><div className="ac-arc-sk" style={{ width: 54, height: 20 }} /></td>
                    <td style={{ padding: '13px 16px' }}><div className="ac-arc-sk" style={{ width: 72, height: 12 }} /></td>
                    <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                      <div className="ac-arc-sk" style={{ width: 66, height: 26, marginLeft: 'auto' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: dark ? '#4d8a6a' : '#a0aec0', fontSize: '0.875rem' }}>
            No archived {SUB_TAB_LABELS[subTab] || subTab}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}` }}>
                  <th style={{ padding: '9px 16px 9px 20px', textAlign: 'left',  fontSize: '0.7rem', fontWeight: 700, color: dark ? '#4d8a6a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Account</th>
                  <th style={{ padding: '9px 16px',           textAlign: 'left',  fontSize: '0.7rem', fontWeight: 700, color: dark ? '#4d8a6a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Type</th>
                  <th style={{ padding: '9px 16px',           textAlign: 'left',  fontSize: '0.7rem', fontWeight: 700, color: dark ? '#4d8a6a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ padding: '9px 16px',           textAlign: 'left',  fontSize: '0.7rem', fontWeight: 700, color: dark ? '#4d8a6a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Archived On</th>
                  <th style={{ padding: '9px 16px',           textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: dark ? '#4d8a6a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const appeal     = appealsByEmail[r.email];
                  const isExpanded = expandedAppeal === r.email;
                  const isLast     = i === rows.length - 1;
                  const initials   = (getName(r) || r.email || '?')[0].toUpperCase();

                  return (
                    <>
                      <tr
                        key={r._id}
                        style={{
                          borderBottom: (!isExpanded && !isLast) ? `1px solid ${dark ? '#1e3a2a' : '#f7f8fa'}` : 'none',
                          borderLeft: '3px solid transparent',
                          background: 'transparent', transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = dark ? '#0d2619' : '#fafbff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Account */}
                        <td style={{ padding: '11px 16px 11px 20px', minWidth: 200 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: dark ? '#2a1f00' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#d97706', flexShrink: 0 }}>
                              {initials}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: dark ? '#eaf5f0' : '#111827' }}>{getName(r)}</div>
                              <div style={{ fontSize: '0.74rem', color: dark ? '#4d8a6a' : '#9ca3af', marginTop: 1 }}>{r.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td style={{ padding: '11px 16px' }}>
                          <TypeBadge subTab={r._type || subTab} />
                        </td>

                        {/* Status */}
                        <td style={{ padding: '11px 16px' }}>
                          {appeal ? (
                            <button
                              onClick={() => setExpandedAppeal(isExpanded ? null : r.email)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 6, border: '1px solid #fde68a', background: isExpanded ? '#fef3c7' : '#fffbeb', fontSize: 11, fontWeight: 700, color: '#92400e', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              <svg width="9" height="9" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10c0 4.418-3.582 8-8 8S2 14.418 2 10 5.582 2 10 2s8 3.582 8 8zm-7-4a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd"/>
                              </svg>
                              Pending Appeal
                            </button>
                          ) : (
                            <span style={{ background: dark ? '#1a1a1a' : '#f3f4f6', color: dark ? '#9ca3af' : '#6b7280', border: `1px solid ${dark ? '#2a2a2a' : '#e5e7eb'}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Archived</span>
                          )}
                        </td>

                        {/* Archived On */}
                        <td style={{ padding: '11px 16px', fontSize: '0.78rem', color: dark ? '#4d8a6a' : '#9ca3af', whiteSpace: 'nowrap' }}>
                          {formatDate(r.updatedAt)}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '11px 16px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                          <button
                            onClick={() => setUnarchiveTarget({ ...r, _subTab: r._type || subTab })}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, border: '1px solid #bbf7d0', background: '#f0fdf4', fontSize: '0.76rem', fontWeight: 600, color: '#16a34a', cursor: 'pointer', transition: 'background 0.12s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'}
                            onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}
                          >
                            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="2" y="6" width="16" height="11" rx="1.5"/>
                              <path d="M2 6l2-3h12l2 3" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M8 11h4M10 9v4" strokeLinecap="round"/>
                            </svg>
                            Restore
                          </button>
                        </td>
                      </tr>

                      {/* Expanded appeal detail */}
                      {isExpanded && appeal && (
                        <tr key={`${r._id}-appeal`} style={{ borderBottom: !isLast ? `1px solid ${dark ? '#1e3a2a' : '#f7f8fa'}` : 'none' }}>
                          <td colSpan={5} style={{ padding: '0 16px 12px 20px' }}>
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '3px solid #f59e0b', borderRadius: 10, padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: '0 0 4px', fontSize: '0.7rem', fontWeight: 700, color: '#b45309', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Appeal Message</p>
                                  <p style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#78350f', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{appeal.reason}</p>
                                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#a78234' }}>Submitted {formatDate(appeal.createdAt)}</p>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                                  <button
                                    onClick={() => handleAppealAction(appeal, 'approve')}
                                    disabled={appealAction === appeal._id}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid #10b981', background: '#f0fdf4', fontSize: '0.78rem', fontWeight: 700, color: '#059669', cursor: appealAction === appeal._id ? 'not-allowed' : 'pointer', opacity: appealAction === appeal._id ? 0.6 : 1 }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    Approve & Enable
                                  </button>
                                  <button
                                    onClick={() => handleAppealAction(appeal, 'dismiss')}
                                    disabled={appealAction === appeal._id}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`, background: dark ? '#0d2619' : '#f9fafb', fontSize: '0.78rem', fontWeight: 600, color: dark ? '#7ab89a' : '#6b7280', cursor: appealAction === appeal._id ? 'not-allowed' : 'pointer', opacity: appealAction === appeal._id ? 0.6 : 1 }}
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
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
