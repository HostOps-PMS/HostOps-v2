// src/pages/ActivityLogs/components/ActivityLogTable.jsx
import { useState, useRef, useEffect } from 'react';

/* ─── Tiny helpers ───────────────────────────────────────────────── */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function RoleBadge({ role, staffRole }) {
  const display = staffRole || role || 'unknown';
  const styles = {
    admin:       { bg: '#fff0f6', color: '#c026d3', dot: '#e879f9' },
    client:      { bg: '#eff6ff', color: '#2563eb', dot: '#60a5fa' },
    staff:       { bg: '#f0fdf4', color: '#16a34a', dot: '#4ade80' },
    team_leader: { bg: '#fff7ed', color: '#ea580c', dot: '#fb923c' },
  };
  const s = styles[role] || { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: '0.72rem', fontWeight: 600,
      padding: '3px 10px', borderRadius: 999,
      background: s.bg, color: s.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {display}
    </span>
  );
}

function ActionBadge({ action }) {
  const lower = (action || '').toLowerCase();
  let bg = '#f3f4f6', color = '#374151';
  if (lower.includes('login'))   { bg = '#e0f2fe'; color = '#0369a1'; }
  if (lower.includes('logout'))  { bg = '#fef3c7'; color = '#92400e'; }
  if (lower.includes('create'))  { bg = '#d1fae5'; color = '#065f46'; }
  if (lower.includes('update') || lower.includes('edit')) { bg = '#ede9fe'; color = '#5b21b6'; }
  if (lower.includes('delete'))  { bg = '#fee2e2'; color = '#b91c1c'; }
  if (lower.includes('view'))    { bg = '#f0f9ff'; color = '#0c4a6e'; }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: '0.72rem', fontWeight: 700,
      padding: '3px 10px', borderRadius: 999,
      background: bg, color,
      whiteSpace: 'nowrap',
    }}>
      {action}
    </span>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */
export default function ActivityLogTable({
  logs,
  clients,
  loading,
  error,
  search,
  filterClient,
  filterAction,
  filterDateFrom,
  filterDateTo,
  onSearchChange,
  onFilterClientChange,
  onFilterActionChange,
  onFilterDateFromChange,
  onFilterDateToChange,
  onClearFilters,
  page,
  totalPages,
  totalCount,
  onPrev,
  onNext,
}) {
  const [activeTab, setActiveTab]             = useState('All');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientSearch, setClientSearch]       = useState('');
  const [showActionDropdown, setShowActionDropdown] = useState(false);

  const tabScrollRef                          = useRef(null);
  const clientDropdownRef                     = useRef(null);
  const actionDropdownRef                     = useRef(null);
  const [tabScrollLeft, setTabScrollLeft]     = useState(0);
  const [tabScrollable, setTabScrollable]     = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target)) {
        setShowClientDropdown(false);
        setClientSearch('');
      }
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target)) {
        setShowActionDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleTabScroll() {
    const el = tabScrollRef.current;
    if (!el) return;
    setTabScrollLeft(el.scrollLeft);
    setTabScrollable(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }

  useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    setTabScrollable(el.scrollWidth > el.clientWidth);
  }, []);

  // Derive unique action types from current logs for dropdown
  const allActionTypes = [...new Set(logs.map(l => l.action).filter(Boolean))].sort();

  const TAB_ICONS = {
    All: (
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
      </svg>
    ),
    Logins: (
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 3v7m0 0l-3-3m3 3l3-3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 17h10" strokeLinecap="round" />
      </svg>
    ),
    Changes: (
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 13l3 3 9-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  const tabCounts = {
    All:     logs.length,
    Logins:  logs.filter(l => l.action?.toLowerCase().includes('login') || l.action?.toLowerCase().includes('logout')).length,
    Changes: logs.filter(l => {
      const a = l.action?.toLowerCase() || '';
      return a.includes('create') || a.includes('update') || a.includes('delete') || a.includes('edit');
    }).length,
  };

  const tabs = [
    { label: 'All',     count: tabCounts.All },
    { label: 'Logins',  count: tabCounts.Logins },
    { label: 'Changes', count: tabCounts.Changes },
  ];

  const tabFiltered = activeTab === 'All' ? logs
    : activeTab === 'Logins'
      ? logs.filter(l => l.action?.toLowerCase().includes('login') || l.action?.toLowerCase().includes('logout'))
      : logs.filter(l => {
          const a = l.action?.toLowerCase() || '';
          return a.includes('create') || a.includes('update') || a.includes('delete') || a.includes('edit');
        });

  const hasActiveFilters = filterClient || filterAction || filterDateFrom || filterDateTo || search;

  const clientMap = Object.fromEntries(clients.map(c => [c._id, c]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Tab bar + stats ──────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 0, flexWrap: 'nowrap', gap: 10, paddingBottom: 0,
        overflow: 'hidden', position: 'relative',
      }}>
        {tabScrollLeft > 0 && (
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 10,
            display: 'flex', alignItems: 'center',
            background: 'linear-gradient(to right, #f0f4f0 60%, transparent)',
            paddingRight: 8, paddingLeft: 2, pointerEvents: 'none',
          }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2.5">
              <path d="M13 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {tabScrollable && (
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10,
            display: 'flex', alignItems: 'center',
            background: 'linear-gradient(to left, #f0f4f0 60%, transparent)',
            paddingLeft: 8, paddingRight: 2, pointerEvents: 'none',
          }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2.5">
              <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        <div
          ref={tabScrollRef}
          onScroll={handleTabScroll}
          style={{
            display: 'flex', alignItems: 'flex-end', gap: 0,
            background: 'transparent',
            padding: '0', marginBottom: '-1px',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none', msOverflowStyle: 'none',
          }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.label;
            return (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '9px 18px 10px',
                  border: '1px solid',
                  borderColor: isActive ? '#e8ecf0' : 'transparent',
                  borderBottom: isActive ? '1px solid #fff' : 'none',
                  borderRadius: '10px 10px 0 0',
                  background: isActive ? '#fff' : 'transparent',
                  marginBottom: '-1px',
                  cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                  color: isActive ? '#10b981' : '#9ca3af',
                  transition: 'color 0.15s', whiteSpace: 'nowrap',
                  position: 'relative', zIndex: isActive ? 2 : 0,
                }}
              >
                {TAB_ICONS[tab.label]}
                {tab.label}
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700,
                  padding: '1px 7px', borderRadius: 999,
                  background: isActive ? '#d1fae5' : 'transparent',
                  color: isActive ? '#10b981' : '#b0b7c3',
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter bar + table container ─────────────────────────── */}
      <div style={{
        background: '#fff', borderRadius: '0 12px 12px 12px',
        border: '1px solid #e8ecf0', overflow: 'visible',
        paddingBottom: 4, position: 'relative',
      }}>

        {/* Filter row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px 14px', borderBottom: '1px solid #f0f2f5',
          flexWrap: 'wrap', rowGap: 8,
        }}>

          {/* Search input */}
          <div style={{ position: 'relative', flex: 1, minWidth: 140, maxWidth: 280 }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="9" cy="9" r="6" /><path d="M15 15l-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search name, email, action…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '7px 12px 7px 32px',
                borderRadius: 8, border: '1px solid #e5e7eb',
                fontSize: '0.83rem', outline: 'none', background: '#fafafa',
                color: '#1a202c',
              }}
            />
          </div>

          <span style={{ fontSize: '0.78rem', color: '#9ca3af', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {totalCount} log{totalCount !== 1 ? 's' : ''}
          </span>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>

            {/* Business filter */}
            <div ref={clientDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
              <div
                onClick={() => setShowClientDropdown(v => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 10px 7px 12px',
                  borderRadius: 8, border: '1px solid #e5e7eb',
                  background: filterClient ? '#f0fdf4' : '#fff',
                  cursor: 'pointer', fontSize: '0.83rem',
                  color: filterClient ? '#059669' : '#374151',
                  fontWeight: filterClient ? 600 : 500,
                  userSelect: 'none', whiteSpace: 'nowrap',
                  maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="16" height="14" rx="2" />
                  <path d="M2 7h16" strokeLinecap="round" />
                </svg>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {filterClient
                    ? (clients.find(c => c._id === filterClient)?.businessName || 'Business')
                    : 'All Businesses'}
                </span>
                <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {showClientDropdown && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0,
                  zIndex: 300, background: '#fff',
                  border: '1.5px solid #e2e8f0', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  minWidth: 210, overflow: 'hidden',
                  display: 'flex', flexDirection: 'column', maxHeight: 280,
                }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
                    <input
                      autoFocus
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      placeholder="Search business…"
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '6px 10px', borderRadius: 6,
                        border: '1.5px solid #e2e8f0', fontSize: '0.83rem',
                        outline: 'none', background: '#fafafa',
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <div
                      onClick={() => { onFilterClientChange(''); setShowClientDropdown(false); setClientSearch(''); }}
                      style={{
                        padding: '9px 14px', cursor: 'pointer', fontSize: '0.875rem',
                        background: !filterClient ? '#f0fdf4' : 'transparent',
                        color: !filterClient ? '#059669' : '#374151',
                        fontWeight: !filterClient ? 600 : 400,
                        borderBottom: '1px solid #f7f7f7',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      All Businesses
                      {!filterClient && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2,6 5,9 10,3" />
                        </svg>
                      )}
                    </div>
                    {clients
                      .filter(c => c && c._id && c.businessName)
                      .filter(c => !clientSearch || c.businessName?.toLowerCase().includes(clientSearch.toLowerCase()))
                      .map(c => (
                        <div
                          key={c._id}
                          onClick={() => { onFilterClientChange(c._id); setShowClientDropdown(false); setClientSearch(''); }}
                          style={{
                            padding: '9px 14px', cursor: 'pointer', fontSize: '0.875rem',
                            background: filterClient === c._id ? '#f0fdf4' : 'transparent',
                            color: filterClient === c._id ? '#059669' : '#374151',
                            fontWeight: filterClient === c._id ? 600 : 400,
                            borderBottom: '1px solid #f7f7f7',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.businessName}
                          </span>
                          {filterClient === c._id && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <polyline points="2,6 5,9 10,3" />
                            </svg>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action filter */}
            <div ref={actionDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
              <div
                onClick={() => setShowActionDropdown(v => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 10px 7px 12px',
                  borderRadius: 8, border: '1px solid #e5e7eb',
                  background: filterAction ? '#f0f4ff' : '#fff',
                  cursor: 'pointer', fontSize: '0.83rem',
                  color: filterAction ? '#3b5fc0' : '#374151',
                  fontWeight: filterAction ? 600 : 500,
                  userSelect: 'none', whiteSpace: 'nowrap',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 5h14M6 10h8M9 15h2" strokeLinecap="round" />
                </svg>
                {filterAction || 'All Actions'}
                <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {showActionDropdown && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0,
                  zIndex: 300, background: '#fff',
                  border: '1.5px solid #e2e8f0', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  minWidth: 190, overflow: 'hidden',
                  display: 'flex', flexDirection: 'column', maxHeight: 280,
                }}>
                  <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                    <div
                      onClick={() => { onFilterActionChange(''); setShowActionDropdown(false); }}
                      style={{
                        padding: '9px 14px', cursor: 'pointer', fontSize: '0.875rem',
                        background: !filterAction ? '#f0f4ff' : 'transparent',
                        color: !filterAction ? '#3b5fc0' : '#374151',
                        fontWeight: !filterAction ? 600 : 400,
                        borderBottom: '1px solid #f7f7f7',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      All Actions
                      {!filterAction && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#3b5fc0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2,6 5,9 10,3" />
                        </svg>
                      )}
                    </div>
                    {allActionTypes.map(a => (
                      <div
                        key={a}
                        onClick={() => { onFilterActionChange(a); setShowActionDropdown(false); }}
                        style={{
                          padding: '9px 14px', cursor: 'pointer', fontSize: '0.875rem',
                          background: filterAction === a ? '#f0f4ff' : 'transparent',
                          color: filterAction === a ? '#3b5fc0' : '#374151',
                          fontWeight: filterAction === a ? 600 : 400,
                          borderBottom: '1px solid #f7f7f7',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        {a}
                        {filterAction === a && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#3b5fc0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2,6 5,9 10,3" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Date from */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => onFilterDateFromChange(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 8, border: '1px solid #e5e7eb',
                  fontSize: '0.83rem', color: filterDateFrom ? '#374151' : '#9ca3af',
                  background: filterDateFrom ? '#fefce8' : '#fff',
                  cursor: 'pointer', outline: 'none',
                }}
                title="From date"
              />
            </div>

            {/* Date to */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => onFilterDateToChange(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 8, border: '1px solid #e5e7eb',
                  fontSize: '0.83rem', color: filterDateTo ? '#374151' : '#9ca3af',
                  background: filterDateTo ? '#fefce8' : '#fff',
                  cursor: 'pointer', outline: 'none',
                }}
                title="To date"
              />
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '7px 12px', borderRadius: 8,
                  border: '1px solid #fecaca', background: '#fff5f5',
                  fontSize: '0.82rem', fontWeight: 600, color: '#dc2626',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Table ───────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#a0aec0', fontSize: '0.875rem' }}>
            Loading activity logs…
          </div>
        ) : tabFiltered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#a0aec0', fontSize: '0.875rem' }}>
            {totalCount === 0 ? 'No activity logs found.' : 'No results match your filters.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f2f5' }}>
                  {['Performed By', 'Business', 'Action', 'Role', 'Date & Time'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px',
                      textAlign: 'left', fontSize: '0.72rem', fontWeight: 700,
                      color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase',
                      whiteSpace: 'nowrap', background: 'transparent',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabFiltered.map((log, i) => {
                  const pb = log.performedBy || {};
                  const name = [pb.firstName, pb.lastName].filter(Boolean).join(' ') || pb.email || '—';

                  return (
                    <>
                      <tr
                        key={log._id}
                        style={{
                          borderBottom: i < tabFiltered.length - 1 ? '1px solid #f7f8fa' : 'none',
                          background: 'transparent',
                          borderLeft: '3px solid transparent',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fafbff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* Performed by */}
                        <td style={{ padding: '12px 16px', minWidth: 160 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
                            {name}
                          </div>
                          {pb.email && name !== pb.email && (
                            <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>{pb.email}</div>
                          )}
                        </td>

                        {/* Business */}
                        <td style={{ padding: '12px 16px', fontSize: '0.83rem', color: '#4a5568', minWidth: 130 }}>
                          {log.businessName || <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>

                        {/* Action */}
                        <td style={{ padding: '12px 16px', minWidth: 140 }}>
                          <ActionBadge action={log.action} />
                        </td>

                        {/* Role */}
                        <td style={{ padding: '12px 16px' }}>
                          <RoleBadge role={pb.role} staffRole={pb.staffRole} />
                        </td>

                        {/* Date & Time */}
                        <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                          {formatDateTime(log.createdAt)}
                        </td>


                      </tr>


                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ───────────────────────────────────────────── */}
        {!loading && totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', borderTop: '1px solid #f0f2f5',
          }}>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {page}/{totalPages} · {totalCount} {totalCount === 1 ? 'log' : 'logs'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onPrev}
                disabled={page === 1}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  background: page === 1 ? '#f9fafb' : '#fff',
                  color: page === 1 ? '#d1d5db' : '#374151',
                  fontSize: '0.82rem', fontWeight: 600,
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={e => { if (page !== 1) e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={e => { if (page !== 1) e.currentTarget.style.background = '#fff'; }}
              >
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M13 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Prev
              </button>
              <button
                onClick={onNext}
                disabled={page === totalPages}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  background: page === totalPages ? '#f9fafb' : '#fff',
                  color: page === totalPages ? '#d1d5db' : '#374151',
                  fontSize: '0.82rem', fontWeight: 600,
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={e => { if (page !== totalPages) e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={e => { if (page !== totalPages) e.currentTarget.style.background = '#fff'; }}
              >
                Next
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}