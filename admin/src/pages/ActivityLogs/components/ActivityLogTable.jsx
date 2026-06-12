// src/pages/ActivityLogs/components/ActivityLogTable.jsx
import React, { useState } from 'react';
import { exportActivityLogs } from '../services/activityLogApi';

// ── Action helpers ────────────────────────────────────────────────────────────
const ACTION_LABELS = {
  login:                   'Logged in',
  logout:                  'Logged out',
  password_changed:        'Password changed',
  pin_changed:             'PIN changed',
  opened_account_settings: 'Opened account settings',
  exported_pdf:            'Exported PDF report',
  changed_date_filter:     'Changed date filter',
  filtered_by_channel:     'Filtered by channel',
  switched_calendar_view:  'Switched calendar view',
  opened_message_thread:   'Opened message thread',
  switched_property:       'Switched property',
};

const ACTION_OPTIONS = [
  { value: '',                         label: 'All Actions' },
  { value: 'login',                    label: 'Login' },
  { value: 'logout',                   label: 'Logout' },
  { value: 'password_changed',         label: 'Password Changed' },
  { value: 'pin_changed',              label: 'PIN Changed' },
  { value: 'switched_property',        label: 'Switched Property' },
  { value: 'opened_account_settings',  label: 'Account Settings Opened' },
  { value: 'exported_pdf',             label: 'Exported PDF' },
];

function getActionMeta(action) {
  switch (action) {
    case 'login':
      return { icon: 'ti-login',           color: '#1e8760', bg: '#eaf8f1', badge: 'Login' };
    case 'logout':
      return { icon: 'ti-logout',          color: '#c13515', bg: '#fff0ee', badge: 'Logout' };
    case 'password_changed':
      return { icon: 'ti-lock',            color: '#f59e0b', bg: '#fffbeb', badge: 'Security' };
    case 'pin_changed':
      return { icon: 'ti-password',        color: '#8b5cf6', bg: '#f5f3ff', badge: 'Security' };
    case 'switched_property':
      return { icon: 'ti-arrows-exchange', color: '#3b82f6', bg: '#eff6ff', badge: 'Switch' };
    case 'exported_pdf':
      return { icon: 'ti-file-export',     color: '#0891b2', bg: '#ecfeff', badge: 'Export' };
    case 'opened_account_settings':
      return { icon: 'ti-settings',        color: '#6b7280', bg: '#f3f4f6', badge: 'Settings' };
    default:
      return { icon: 'ti-info-circle',     color: '#9ab8a9', bg: '#f7faf8', badge: 'Event' };
  }
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

/**
 * Escape a single CSV field value.
 * Wraps the value in double-quotes and escapes any existing double-quotes
 * inside it so the output is valid RFC 4180 CSV.
 */
function csvField(value) {
  const str = value == null ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Convert an array of ActivityLog entries into a CSV string.
 * Columns: Action, Badge, Business, Performed By, Role, Email,
 *          Date & Time, IP Address, Property, Meta (JSON)
 */
function buildCsv(entries) {
  const HEADERS = [
    'Action',
    'Badge',
    'Business',
    'Performed By',
    'Role',
    'Email',
    'Date & Time',
    'IP Address',
    'Property',
    'Meta',
  ];

  const rows = entries.map((e) => {
    const label = ACTION_LABELS[e.action] || e.action;
    const badge = getActionMeta(e.action).badge;
    const pb    = e.performedBy || {};
    const name  = [pb.firstName, pb.lastName].filter(Boolean).join(' ') || pb.email || '';
    const role  = pb.staffRole || pb.role || 'client';
    const email = pb.email || '';
    const time  = new Date(e.createdAt || e.timestamp).toLocaleString('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
    const biz  = e.businessName || pb.businessName || '';
    const ip   = e.ipAddress || '';

    // Property: prefer switched_property meta, else generic meta.propertyName
    let property = '';
    if (e.action === 'switched_property') {
      const from = e.meta?.fromPropertyName || e.meta?.fromPropertyId || '';
      const to   = e.meta?.toPropertyName   || e.meta?.toPropertyId   || '';
      if (from || to) property = `${from} → ${to}`;
    } else {
      property = e.meta?.propertyName || '';
    }

    const meta = e.meta && Object.keys(e.meta).length > 0
      ? JSON.stringify(e.meta)
      : '';

    return [label, badge, biz, name, role, email, time, ip, property, meta]
      .map(csvField)
      .join(',');
  });

  return [HEADERS.map(csvField).join(','), ...rows].join('\n');
}

/**
 * Build a descriptive filename that reflects the active filters.
 * Examples:
 *   activity-logs-2024-01-01-to-2024-03-31.csv
 *   activity-logs-login-2024-06-01.csv
 *   activity-logs-all-2024-06-11.csv
 */
function buildFilename({ filterAction, filterDateFrom, filterDateTo }) {
  const today = new Date().toISOString().slice(0, 10);
  const parts  = ['activity-logs'];

  if (filterAction)   parts.push(filterAction.replace(/_/g, '-'));
  if (filterDateFrom) parts.push(filterDateFrom);
  if (filterDateTo)   parts.push('to', filterDateTo);
  if (!filterDateFrom && !filterDateTo) parts.push(today);

  return `${parts.join('-')}.csv`;
}

// ── Expanded row detail ───────────────────────────────────────────────────────
function ExpandedDetail({ entry }) {
  const time = new Date(entry.createdAt || entry.timestamp).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  const pb = entry.performedBy || {};
  const performedByName = [pb.firstName, pb.lastName].filter(Boolean).join(' ') || pb.email || '—';
  const performedByRole = pb.staffRole || pb.role || 'client';

  const rows = [
    { label: 'Timestamp',        value: time },
    entry.businessName && { label: 'Business Account', value: entry.businessName },
    (pb.firstName || pb.email) && {
      label: 'Performed By',
      value: `${performedByName} (${performedByRole})`,
    },
    // For switched_property: show From and To as separate rows
    entry.action === 'switched_property' && (entry.meta?.fromPropertyName || entry.meta?.fromPropertyId) && {
      label: 'Switched From',
      value: entry.meta.fromPropertyName || entry.meta.fromPropertyId,
      color: '#6b7280',
      badge: true,
    },
    entry.action === 'switched_property' && (entry.meta?.toPropertyName || entry.meta?.toPropertyId) && {
      label: 'Switched To',
      value: entry.meta.toPropertyName || entry.meta.toPropertyId,
      color: '#1d4ed8',
      highlight: true,
    },
    // For non-switch entries, show generic property
    entry.action !== 'switched_property' && entry.meta?.propertyName && {
      label: 'Property', value: entry.meta.propertyName,
    },
    entry.ipAddress && { label: 'IP Address', value: entry.ipAddress },
  ].filter(Boolean);

  return (
    <td
      colSpan={5}
      style={{
        padding: '0 16px 14px 56px',
        background: '#f7fbf9',
        borderBottom: '1px solid #eaf3ee',
      }}
    >
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '10px 32px',
        paddingTop: 10,
      }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: r.highlight ? '#3b82f6' : '#9ab8a9',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {r.label}
            </span>
            <span style={{
              fontSize: 12, fontWeight: r.highlight ? 700 : 600,
              color: r.color || '#0c1c14',
              background: r.highlight ? '#eff6ff' : r.badge ? '#f3f4f6' : 'transparent',
              borderRadius: r.highlight || r.badge ? 5 : 0,
              padding: r.highlight || r.badge ? '1px 7px' : 0,
              border: r.highlight ? '1px solid #bfdbfe' : r.badge ? '1px solid #e5e7eb' : 'none',
              display: 'inline-block',
            }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </td>
  );
}

// ── Searchable dropdown ───────────────────────────────────────────────────────
function AlDropdown({ value, onChange, options, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = React.useRef(null);

  React.useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false); setSearch('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const filtered = options.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  );
  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative', flex: '1 1 120px', minWidth: 0 }}>
      <div
        onClick={() => { if (!disabled) setOpen(v => !v); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          padding: '8px 10px 8px 12px',
          border: '1.5px solid #d4e8dd', borderRadius: 9,
          background: value ? '#eaf8f1' : '#f7faf8',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 13, fontWeight: value ? 600 : 400,
          color: value ? '#1e8760' : '#0c1c14',
          userSelect: 'none', whiteSpace: 'nowrap',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {selected?.label || options[0]?.label || '—'}
        </span>
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          zIndex: 9999, background: '#fff',
          border: '1.5px solid #d4e8dd', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          minWidth: 200, maxWidth: 280,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #eaf3ee' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '6px 10px', borderRadius: 6,
                border: '1.5px solid #d4e8dd', fontSize: 12,
                outline: 'none', background: '#f7faf8', fontFamily: 'inherit',
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.map(o => (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                style={{
                  padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                  background: value === o.value ? '#eaf8f1' : 'transparent',
                  color: value === o.value ? '#1e8760' : '#0c1c14',
                  fontWeight: value === o.value ? 600 : 400,
                  borderBottom: '1px solid #f0f7f3',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}
                onMouseEnter={e => { if (value !== o.value) e.currentTarget.style.background = '#f7fbf9'; }}
                onMouseLeave={e => { e.currentTarget.style.background = value === o.value ? '#eaf8f1' : 'transparent'; }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                {value === o.value && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#1e8760" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="2,6 5,9 10,3"/>
                  </svg>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '12px 14px', fontSize: 12, color: '#9ab8a9', textAlign: 'center' }}>
                No results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ActivityLogTable({
  logs = [],
  clients = [],
  loading = false,
  search = '',
  filterClient = '',
  filterAction = '',
  filterDateFrom = '',
  filterDateTo = '',
  onSearchChange,
  onFilterClientChange,
  onFilterActionChange,
  onFilterDateFromChange,
  onFilterDateToChange,
  onClearFilters,
  page = 1,
  totalPages = 1,
  totalCount = 0,
  onPrev,
  onNext,
}) {
  const [expandedRow,   setExpandedRow]   = useState(null);
  const [exporting,     setExporting]     = useState(false);
  const [exportError,   setExportError]   = useState('');

  const hasFilters = search || filterClient || filterAction || filterDateFrom || filterDateTo;

  // ── CSV export ──────────────────────────────────────────────────────────────
  // Fetches ALL records that match the current server-side filters
  // (userId / action / from / to), not just the current page.
  async function handleExport() {
    setExporting(true);
    setExportError('');
    try {
      const allLogs = await exportActivityLogs({
        userId: filterClient,
        action: filterAction,
        from:   filterDateFrom,
        to:     filterDateTo ? filterDateTo + 'T23:59:59' : '',
      });

      const csv      = buildCsv(allLogs);
      const filename = buildFilename({ filterAction, filterDateFrom, filterDateTo });
      const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message || 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <style>{`
        .al-table-wrap { background: #fff; border-radius: 14px; border: 1px solid #eaf3ee; overflow: visible; box-shadow: 0 2px 8px rgba(12,28,20,0.05); box-sizing: border-box; width: 100%; }
        .al-filters { display: flex; flex-wrap: wrap; gap: 10px; padding: 12px 16px; border-bottom: 1px solid #eaf3ee; align-items: center; }
        .al-search-wrap { position: relative; flex: 1; min-width: 160px; max-width: 260px; }
        @media (min-width: 641px) {
          .al-filters { flex-direction: row !important; flex-wrap: nowrap !important; align-items: center; padding: 10px 16px !important; }
          .al-filters-row1, .al-filters-row2, .al-filters-row3, .al-filters-row4 { display: contents !important; }
          .al-filters-row1 .al-search-wrap { flex: 1 1 160px; min-width: 0; max-width: none !important; width: auto !important; }
          .al-select { flex: 1 1 120px; min-width: 0; }
          .al-date-input { flex: 1 1 110px; min-width: 0; }
          .al-export-btn { margin-left: auto !important; flex-shrink: 0; width: auto !important; }
          .al-clear-btn { flex-shrink: 0; }
        }
        @media (max-width: 640px) {
          .al-filters { gap: 0; padding: 0; flex-direction: column; }
          .al-filters-row1 { display: flex !important; width: 100%; padding: 10px 12px 8px; box-sizing: border-box; }
          .al-filters-row2 { display: flex !important; width: 100%; padding: 0 12px 8px; box-sizing: border-box; gap: 8px; flex-wrap: nowrap; }
          .al-filters-row2 select { flex: 1; min-width: 0; max-width: 50%; }
          .al-filters-row3 { display: flex !important; width: 100%; padding: 0 12px 8px; box-sizing: border-box; gap: 6px; align-items: center; flex-wrap: nowrap; }
          .al-filters-row3 .al-date-input { flex: 1; min-width: 0; max-width: calc(50% - 16px); }
          .al-filters-row4 { display: flex !important; width: 100%; padding: 0 12px 12px; box-sizing: border-box; }
          .al-search-wrap { max-width: 100% !important; flex: 1; }
          .al-select { flex: 1; font-size: 12px; min-width: 0; }
          .al-date-input { flex: 1; font-size: 12px; min-width: 0; }
          .al-date-sep { flex-shrink: 0; }
          .al-clear-btn { flex-shrink: 0; padding: 7px 10px; }
          .al-export-btn { margin-left: 0 !important; width: 100%; justify-content: center; }
          .al-pagination { flex-direction: column; align-items: flex-start; gap: 10px; }
          .al-page-btns { justify-content: flex-end; }
          .al-table-wrap { border-radius: 12px; overflow: visible !important; }
          .al-page-info { width: 100%; text-align: center; }
        }
        .al-search-wrap { position: relative; flex: 1; min-width: 180px; max-width: 280px; }
        .al-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #9ab8a9; pointer-events: none; display: flex; }
        .al-search-input { width: 100%; padding: 8px 12px 8px 34px; border: 1.5px solid #d4e8dd; border-radius: 9px; font-size: 13px; color: #0c1c14; background: #f7faf8; outline: none; box-sizing: border-box; font-family: inherit; transition: border-color 0.15s, box-shadow 0.15s; }
        .al-search-input:focus { border-color: #1e8760; box-shadow: 0 0 0 3px rgba(30,135,96,0.09); background: #fff; }
        .al-select { padding: 8px 12px; border: 1.5px solid #d4e8dd; border-radius: 9px; font-size: 13px; color: #0c1c14; background: #f7faf8; outline: none; cursor: pointer; font-family: inherit; transition: border-color 0.15s; }
        .al-select:focus { border-color: #1e8760; }
        .al-date-input { padding: 8px 10px; border: 1.5px solid #d4e8dd; border-radius: 9px; font-size: 13px; color: #0c1c14; background: #f7faf8; outline: none; font-family: inherit; transition: border-color 0.15s; }
        .al-date-input:focus { border-color: #1e8760; }
        .al-clear-btn { padding: 7px 14px; border: 1.5px solid #fca5a5; border-radius: 9px; background: #fff5f5; color: #c13515; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 5px; transition: background 0.15s; white-space: nowrap; }
        .al-clear-btn:hover { background: #fee2e2; }
        .al-export-btn { margin-left: auto; padding: 7px 14px; border: 1.5px solid #d4e8dd; border-radius: 9px; background: #eaf8f1; color: #1e8760; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 5px; transition: background 0.15s; white-space: nowrap; }
        .al-export-btn:hover { background: #d1f5e6; }
        .al-export-btn:disabled { background: #f7faf8; color: #9ab8a9; border-color: #e5ede8; cursor: not-allowed; }
        .al-export-error { font-size: 11px; color: #c13515; background: #fff0ee; border: 1px solid #fca5a5; border-radius: 7px; padding: 5px 10px; margin: 0 16px 10px; display: flex; align-items: center; gap: 5px; }
        .al-table { width: 100%; border-collapse: collapse; }
        .al-thead th { padding: 10px 16px; text-align: left; font-size: 10px; font-weight: 700; color: #9ab8a9; text-transform: uppercase; letter-spacing: 0.07em; background: #f7faf8; border-bottom: 1px solid #eaf3ee; white-space: nowrap; }
        .al-row { border-bottom: 1px solid #f0f7f3; transition: background 0.1s; }
        .al-row:last-child { border-bottom: none; }
        .al-row:hover > td { background: #f7fbf9; }
        .al-row.expanded > td { background: #f7fbf9; }
        .al-td { padding: 11px 16px; font-size: 13px; color: #0c1c14; vertical-align: middle; }
        .al-action-cell { display: flex; align-items: center; gap: 9px; }
        .al-icon-circle { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .al-badge { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 20px; font-size: 10px; font-weight: 700; border: 1px solid; white-space: nowrap; }
        .al-detail-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 11px; border-radius: 7px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.15s; border: 1px solid #d4e8dd; background: #fff; color: #4a6b5a; }
        .al-detail-btn:hover { background: #f0f8f4; }
        .al-detail-btn.open { border-color: rgba(30,135,96,0.4); background: #eaf8f1; color: #1e8760; }
        .al-pagination { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid #eaf3ee; background: #f7faf8; flex-wrap: wrap; gap: 8px; border-radius: 0 0 14px 14px; overflow: visible; }
        .al-page-info { font-size: 12px; color: #9ab8a9; font-weight: 500; }
        .al-page-btns { display: flex; align-items: center; gap: 6px; }
        .al-page-btn { padding: 6px 14px; border-radius: 8px; border: 1.5px solid #d4e8dd; background: #fff; color: #0c1c14; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 5px; transition: all 0.15s; }
        .al-page-btn:hover:not(:disabled) { background: #eaf8f1; border-color: #1e8760; color: #1e8760; }
        .al-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .al-page-num { padding: 6px 12px; border-radius: 8px; background: #0c1c14; color: #eaf5f0; font-size: 12px; font-weight: 700; }
        .al-empty { padding: 52px 20px; text-align: center; }
        .al-loading { padding: 52px 20px; text-align: center; color: #9ab8a9; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        @keyframes al-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .al-spinner { animation: al-spin 0.8s linear infinite; }
        .al-date-sep { font-size: 12px; color: #9ab8a9; font-weight: 500; }
      `}</style>

      <div className="al-table-wrap">

        {/* ── Filters bar ── */}
        <div className="al-filters">

          {/* Row 1 — Search full width */}
          <div className="al-filters-row1">
            <div className="al-search-wrap">
              <span className="al-search-icon">
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="9" r="7" />
                  <path d="M15 15l3 3" strokeLinecap="round" />
                </svg>
              </span>
              <input
                className="al-search-input"
                type="text"
                placeholder="Search by name, email, action…"
                value={search}
                onChange={e => onSearchChange(e.target.value)}
              />
            </div>
          </div>

          {/* Row 2 — Client + Action filters */}
          <div className="al-filters-row2">
            {clients.length > 0 && (
              <AlDropdown
                value={filterClient}
                onChange={onFilterClientChange}
                options={[
                  { value: '', label: 'All Businesses' },
                  ...clients.map(c => ({ value: c._id || c.id, label: c.businessName || c.name || c.email })),
                ]}
              />
            )}
            <AlDropdown
              value={filterAction}
              onChange={onFilterActionChange}
              options={ACTION_OPTIONS}
            />
          </div>

          {/* Row 3 — Date range + Clear */}
          <div className="al-filters-row3">
            <input
              className="al-date-input"
              type="date"
              title="From date"
              value={filterDateFrom}
              onChange={e => onFilterDateFromChange(e.target.value)}
            />
            <span className="al-date-sep">–</span>
            <input
              className="al-date-input"
              type="date"
              title="To date"
              value={filterDateTo}
              onChange={e => onFilterDateToChange(e.target.value)}
            />
            {hasFilters && (
              <button className="al-clear-btn" onClick={onClearFilters}>
                <i className="ti ti-x" style={{ fontSize: 12 }} />
                Clear
              </button>
            )}
          </div>

          {/* Row 4 — Export */}
          <div className="al-filters-row4">
            <button
              className="al-export-btn"
              onClick={handleExport}
              disabled={exporting || totalCount === 0}
              title={
                filterDateFrom || filterDateTo
                  ? `Export filtered records (${filterDateFrom || '…'} – ${filterDateTo || '…'})`
                  : 'Export all records as CSV'
              }
            >
              {exporting
                ? <><i className="ti ti-loader-2 al-spinner" style={{ fontSize: 13 }} /> Exporting…</>
                : <><i className="ti ti-download" style={{ fontSize: 13 }} /> Export CSV</>
              }
            </button>
          </div>
        </div>

        {/* ── Export error banner ── */}
        {exportError && (
          <div className="al-export-error">
            <i className="ti ti-alert-circle" style={{ fontSize: 13 }} />
            {exportError}
          </div>
        )}

        {/* ── Table body ── */}
        {loading ? (
          <div className="al-loading">
            <i className="ti ti-loader-2 al-spinner" style={{ fontSize: 18 }} />
            Loading activity logs…
          </div>
        ) : logs.length === 0 ? (
          <div className="al-empty">
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: '#f0f8f4', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', marginBottom: 12,
            }}>
              <i className="ti ti-clipboard-list" style={{ fontSize: 24, color: '#9ab8a9' }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0c1c14', margin: '0 0 4px' }}>
              No activity logs found
            </p>
            <p style={{ fontSize: 13, color: '#9ab8a9', margin: 0 }}>
              {hasFilters ? 'Try adjusting your filters.' : 'No actions have been recorded yet.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="al-table" style={{ minWidth: 580 }}>
            <thead className="al-thead">
              <tr>
                <th>Action</th>
                <th>Business</th>
                <th>Performed By</th>
                <th>Date & Time</th>
                <th style={{ textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry, i) => {
                const meta       = getActionMeta(entry.action);
                const label      = ACTION_LABELS[entry.action] || entry.action;
                const isExpanded = expandedRow === i;
                const pb         = entry.performedBy || {};
                const name       = [pb.firstName, pb.lastName].filter(Boolean).join(' ') || pb.email || '—';
                const role       = pb.staffRole || pb.role || 'client';
                const bizName    = entry.businessName || pb.businessName || '—';
                const time       = new Date(entry.createdAt || entry.timestamp).toLocaleString('en-PH', {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: 'numeric', minute: '2-digit', hour12: true,
                });

                return (
                  <React.Fragment key={entry._id || i}>
                    <tr className={`al-row${isExpanded ? ' expanded' : ''}`}>

                      {/* Action */}
                      <td className="al-td">
                        <div className="al-action-cell">
                          <div
                            className="al-icon-circle"
                            style={{ background: meta.bg, border: `1.5px solid ${meta.color}22` }}
                          >
                            <i className={`ti ${meta.icon}`} style={{ fontSize: 14, color: meta.color }} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#0c1c14' }}>{label}</div>
                            <span
                              className="al-badge"
                              style={{
                                background: meta.bg,
                                color: meta.color,
                                borderColor: `${meta.color}33`,
                                marginTop: 3,
                              }}
                            >
                              {meta.badge}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Business */}
                      <td className="al-td" style={{ color: bizName === '—' ? '#9ab8a9' : '#0c1c14' }}>
                        {bizName}
                      </td>

                      {/* Performed By */}
                      <td className="al-td">
                        <div style={{ fontWeight: 500 }}>{name}</div>
                        <div style={{ fontSize: 11, color: '#9ab8a9', marginTop: 1, textTransform: 'capitalize' }}>
                          {role}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="al-td" style={{ whiteSpace: 'nowrap', color: '#4a6b5a', fontSize: 12 }}>
                        {time}
                      </td>

                      {/* Details toggle */}
                      <td className="al-td" style={{ textAlign: 'center' }}>
                        <button
                          className={`al-detail-btn${isExpanded ? ' open' : ''}`}
                          onClick={() => setExpandedRow(isExpanded ? null : i)}
                        >
                          <i
                            className="ti ti-chevron-down"
                            style={{
                              fontSize: 11,
                              transition: 'transform 0.2s',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}
                          />
                          {isExpanded ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr className="al-row expanded">
                        <ExpandedDetail entry={entry} />
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && logs.length > 0 && (
          <div className="al-pagination">
            <span className="al-page-info">
              {totalCount > 0
                ? `Showing page ${page} of ${totalPages} · ${totalCount.toLocaleString()} total records`
                : `Page ${page} of ${totalPages}`}
            </span>
            <div className="al-page-btns" style={{ display: 'flex', gap: 6 }}>
              <button
                className="al-page-btn"
                onClick={onPrev}
                disabled={page <= 1}
              >
                <i className="ti ti-chevron-left" style={{ fontSize: 13 }} />
                Prev
              </button>
              <button
                className="al-page-btn"
                onClick={onNext}
                disabled={page >= totalPages}
              >
                Next
                <i className="ti ti-chevron-right" style={{ fontSize: 13 }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}