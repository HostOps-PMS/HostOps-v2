import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';

const TAB_ICONS = {
  All: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
    </svg>
  ),
  Active: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="2,12 5,8 8,11 12,6 15,9 18,5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Inactive: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 7v3M10 13h.01" strokeLinecap="round" />
    </svg>
  ),
};

export default function TeamLeaderTable({
  teamLeaders,
  clients,
  filtered,
  loading,
  error,
  search,
  onSearchChange,
  onEdit,
  onDelete,
  onArchive,
  onNew,
  onRowClick,
  page,
  totalPages,
  totalCount,
  onPrev,
  onNext,
}) {
  const clientMap = Object.fromEntries(clients.map((c) => [c._id, c]));

  const { dark } = useTheme();
  const [activeTab, setActiveTab] = useState('All');
  const tabScrollRef = useRef(null);
  const [tabScrollLeft, setTabScrollLeft] = useState(0);
  const [tabScrollable, setTabScrollable] = useState(false);

  function handleTabScroll() {
    const el = tabScrollRef.current;
    if (!el) return;
    setTabScrollLeft(el.scrollLeft);
    setTabScrollable(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }

  const tabs = [
    { label: 'All', count: teamLeaders.length },
    { label: 'Active', count: teamLeaders.filter((tl) => tl.isActive).length },
    { label: 'Inactive', count: teamLeaders.filter((tl) => !tl.isActive).length },
  ];

  useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    setTabScrollable(el.scrollWidth > el.clientWidth);
  }, [tabs.length]);

  const tabFiltered =
    activeTab === 'All'
      ? filtered
      : activeTab === 'Active'
      ? filtered.filter((tl) => tl.isActive)
      : filtered.filter((tl) => !tl.isActive);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Top header: tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 0, flexWrap: 'nowrap', gap: 10, paddingBottom: 0,
        overflow: 'hidden', position: 'sticky', top: 0, zIndex: 100,
        background: dark ? '#0c1c14' : 'var(--color-bg, #f2f4f7)',
      }}>
        {tabScrollLeft > 0 && (
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 10,
            display: 'flex', alignItems: 'center',
            background: dark ? 'linear-gradient(to right, #0c1c14 60%, transparent)' : 'linear-gradient(to right, #f0f4f0 60%, transparent)',
            paddingRight: 8, paddingLeft: 2, pointerEvents: 'none',
          }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2.5">
              <path d="M13 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
        {tabScrollable && (
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10,
            display: 'flex', alignItems: 'center',
            background: dark ? 'linear-gradient(to left, #0c1c14 60%, transparent)' : 'linear-gradient(to left, #f0f4f0 60%, transparent)',
            paddingLeft: 8, paddingRight: 2, pointerEvents: 'none',
          }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2.5">
              <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
        <div
          ref={tabScrollRef}
          onScroll={handleTabScroll}
          style={{
            display: 'flex', alignItems: 'flex-end', gap: 0,
            background: 'transparent',
            padding: '0 0 0 0', marginBottom: '-1px',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none', msOverflowStyle: 'none',
          }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.label;
            return (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '9px 18px 10px',
                  border: '1px solid',
                  borderColor: isActive ? (dark ? '#1e3a2a' : '#e8ecf0') : 'transparent',
                  borderBottom: isActive ? `1px solid ${dark ? '#132a1e' : '#fff'}` : 'none',
                  borderRadius: '10px 10px 0 0',
                  background: isActive ? (dark ? '#132a1e' : '#fff') : 'transparent',
                  marginBottom: '-1px',
                  cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                  color: isActive ? '#10b981' : (dark ? '#4d8a6a' : '#9ca3af'),
                  transition: 'color 0.15s', whiteSpace: 'nowrap',
                  position: 'relative', zIndex: isActive ? 2 : 0,
                  boxShadow: 'none',
                }}
              >
                {TAB_ICONS[tab.label]}
                {tab.label}
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700,
                  padding: '1px 7px', borderRadius: 999,
                  background: isActive ? (dark ? '#0d2619' : '#d1fae5') : 'transparent',
                  color: isActive ? '#10b981' : (dark ? '#4d8a6a' : '#b0b7c3'),
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter bar + table */}
      <div style={{
        background: dark ? '#132a1e' : '#fff', borderRadius: '0 12px 12px 12px',
        border: `1px solid ${dark ? '#1e3a2a' : '#e8ecf0'}`, overflow: 'visible',
        paddingBottom: 4, position: 'relative',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px 14px', borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}`, flexWrap: 'wrap', rowGap: 8,
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 120, maxWidth: 280 }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="9" cy="9" r="6" /><path d="M15 15l-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter team leaders…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '7px 12px 7px 32px',
                borderRadius: 8, border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`,
                fontSize: '0.83rem', outline: 'none', background: dark ? '#0d2619' : '#fafafa',
                color: dark ? '#eaf5f0' : '#1a202c',
              }}
            />
          </div>
          <span style={{ fontSize: '0.78rem', color: dark ? '#4d8a6a' : '#9ca3af', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {tabFiltered.length} team leader{tabFiltered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: dark ? '#4d8a6a' : '#a0aec0', fontSize: '0.875rem' }}>
            Loading team leaders…
          </div>
        ) : tabFiltered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: dark ? '#4d8a6a' : '#a0aec0', fontSize: '0.875rem' }}>
            {teamLeaders.length === 0
              ? 'No team leaders yet. Create one to get started.'
              : 'No results match your search.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}` }}>
                  {['Team Leader', 'Assigned Server', 'Created', ''].map((h) => (
                    <th key={h} style={{
                      padding: '10px 16px',
                      textAlign: 'left', fontSize: '0.72rem', fontWeight: 700,
                      color: dark ? '#4d8a6a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase',
                      whiteSpace: 'nowrap', background: 'transparent',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabFiltered.map((tl, i) => {
                  const client = clientMap[tl.serverId?._id || tl.serverId];
                  return (
                    <tr
                      key={tl._id}
                      style={{
                        borderBottom: i < tabFiltered.length - 1 ? `1px solid ${dark ? '#1e3a2a' : '#f7f8fa'}` : 'none',
                        background: 'transparent',
                        transition: 'background 0.1s',
                        cursor: 'pointer',
                      }}
                      onClick={() => onRowClick && onRowClick(tl)}
                      onMouseEnter={(e) => { e.currentTarget.style.background = dark ? '#0d2619' : '#fafbff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Team Leader name + email */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: dark ? '#eaf5f0' : '#111827' }}>
                          {tl.firstName} {tl.lastName}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: dark ? '#4d8a6a' : '#9ca3af', marginTop: 2 }}>{tl.email}</div>
                      </td>

                      {/* Assigned Server */}
                      <td style={{ padding: '12px 16px', fontSize: '0.83rem', color: dark ? '#7ab89a' : '#4a5568' }}>
                        {client
                          ? `${client.firstName} ${client.lastName}`
                          : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>

                      {/* Created */}
                      <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: dark ? '#4d8a6a' : '#9ca3af', whiteSpace: 'nowrap' }}>
                        {new Date(tl.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px 12px 8px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); onEdit(tl); }}
                            style={{
                              padding: '5px 14px', borderRadius: 6,
                              border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`, background: dark ? '#0d2619' : '#fff',
                              fontSize: '0.78rem', fontWeight: 600, color: dark ? '#7ab89a' : '#374151', cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onArchive && onArchive(tl); }}
                            style={{
                              padding: '5px 12px', borderRadius: 6,
                              border: '1px solid #fbbf24', background: dark ? '#2a1f00' : '#fffbeb',
                              fontSize: '0.78rem', fontWeight: 600, color: dark ? '#fbbf24' : '#92400e', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="2" y="6" width="16" height="11" rx="1.5"/><path d="M2 6l2-3h12l2 3" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 11h4" strokeLinecap="round"/>
                            </svg>
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px',
            borderTop: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}`,
          }}>
            <span style={{ fontSize: '0.78rem', color: dark ? '#4d8a6a' : '#9ca3af' }}>
              Page {page} of {totalPages} · {totalCount} {totalCount === 1 ? 'Team Leader' : 'Team Leaders'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onPrev}
                disabled={page === 1}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8,
                  border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`,
                  background: page === 1 ? (dark ? '#0a1a10' : '#f9fafb') : (dark ? '#0d2619' : '#fff'),
                  color: page === 1 ? (dark ? '#2a4a35' : '#d1d5db') : (dark ? '#7ab89a' : '#374151'),
                  fontSize: '0.82rem', fontWeight: 600,
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (page !== 1) e.currentTarget.style.background = dark ? '#132a1e' : '#f3f4f6'; }}
                onMouseLeave={e => { if (page !== 1) e.currentTarget.style.background = dark ? '#0d2619' : '#fff'; }}
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
                  border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`,
                  background: page === totalPages ? (dark ? '#0a1a10' : '#f9fafb') : (dark ? '#0d2619' : '#fff'),
                  color: page === totalPages ? (dark ? '#2a4a35' : '#d1d5db') : (dark ? '#7ab89a' : '#374151'),
                  fontSize: '0.82rem', fontWeight: 600,
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (page !== totalPages) e.currentTarget.style.background = dark ? '#132a1e' : '#f3f4f6'; }}
                onMouseLeave={e => { if (page !== totalPages) e.currentTarget.style.background = dark ? '#0d2619' : '#fff'; }}
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