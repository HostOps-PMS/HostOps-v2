import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function StatusBadge({ status }) {
  const { dark } = useTheme();
  if (status === 'published') return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: dark ? '#0d2619' : '#f0fdf4', color: dark ? '#4ade80' : '#16a34a', display: 'inline-block',
    }}>Published</span>
  );
  if (status === 'archived') return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: dark ? '#1a1a1a' : '#f3f4f6', color: dark ? '#9ca3af' : '#6b7280', display: 'inline-block',
    }}>Archived</span>
  );
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: dark ? '#2a1f00' : '#fff8e1', color: dark ? '#fbbf24' : '#7a6a00', display: 'inline-block',
    }}>Draft</span>
  );
}

function PriorityBadge({ priority }) {
  const { dark } = useTheme();
  const map = {
    urgent: { bg: dark ? '#2a0a0a' : '#fef2f2', color: dark ? '#f87171' : '#b91c1c', label: 'Urgent' },
    high:   { bg: dark ? '#2a1f00' : '#fff8e1', color: dark ? '#fbbf24' : '#b45309', label: 'High' },
    normal: { bg: dark ? '#0d1a2a' : '#eff6ff', color: dark ? '#60a5fa' : '#2563eb', label: 'Normal' },
    low:    { bg: dark ? '#1a1a1a' : '#f3f4f6', color: dark ? '#9ca3af' : '#6b7280', label: 'Low' },
  };
  const s = map[priority] || map.normal;
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: s.bg, color: s.color, display: 'inline-block',
    }}>{s.label}</span>
  );
}

function AudienceBadge({ audience, targetClients }) {
  const { dark } = useTheme();
  if (audience === 'selected' && targetClients?.length) {
    const names = targetClients.map(c => c.businessName || c.email || c).slice(0, 2);
    const extra = targetClients.length - 2;
    return (
      <span style={{
        fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
        background: dark ? '#1a1040' : '#e0e7ff', color: dark ? '#a78bfa' : '#4338ca', display: 'inline-block',
        maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }} title={targetClients.map(c => c.businessName || c.email || c).join(', ')}>
        {names.join(', ')}{extra > 0 ? ` +${extra}` : ''}
      </span>
    );
  }
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: dark ? '#0d2619' : '#d1fae5', color: dark ? '#4ade80' : '#059669', display: 'inline-block',
    }}>All Clients</span>
  );
}

const TAB_ICONS = {
  All: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
    </svg>
  ),
  Published: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="4,10 8,14 16,6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Draft: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 3H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4" strokeLinecap="round"/>
      <path d="M14 2l4 4-7 7H7v-4l7-7z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Archived: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="16" height="11" rx="1.5"/><path d="M2 6l2-3h12l2 3" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 11h4" strokeLinecap="round"/>
    </svg>
  ),
};

export default function AnnouncementsTable({
  announcements, loading, search, onSearchChange, onRefresh,
  onRowClick, onDelete,
  page, totalPages, totalCount, onPrev, onNext,
}) {
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
    { label: 'All',       count: announcements.length },
    { label: 'Published', count: announcements.filter(a => a.status === 'published').length },
    { label: 'Draft',     count: announcements.filter(a => a.status === 'draft').length },
    { label: 'Archived',  count: announcements.filter(a => a.status === 'archived').length },
  ];

  useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    setTabScrollable(el.scrollWidth > el.clientWidth);
  }, [tabs.length]);

  const tabFiltered =
    activeTab === 'All' ? announcements
    : activeTab === 'Published' ? announcements.filter(a => a.status === 'published')
    : activeTab === 'Draft' ? announcements.filter(a => a.status === 'draft')
    : announcements.filter(a => a.status === 'archived');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Tab bar */}
      <div style={{
        marginBottom: 0, paddingBottom: 0,
        position: 'sticky', top: 0, zIndex: 100,
        overflow: 'visible',
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
            background: 'transparent', marginBottom: '-1px',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            msOverflowStyle: 'none', scrollbarWidth: 'none',
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
          padding: '10px 12px 12px', borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}`, flexWrap: 'wrap', rowGap: 8,
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 120, maxWidth: 280 }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by title…"
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
            {tabFiltered.length} {tabFiltered.length === 1 ? 'Announcement' : 'Announcements'}
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={onRefresh}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 10px', borderRadius: 8,
                border: '1px solid #10b981', background: dark ? '#0d2619' : '#fff',
                fontSize: '0.82rem', fontWeight: 600, color: '#10b981',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4a8 8 0 0112.97 3M16 16a8 8 0 01-12.97-3" strokeLinecap="round" />
                <path d="M4 8V4H0" strokeLinecap="round" strokeLinejoin="round" transform="translate(4 0)" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: dark ? '#4d8a6a' : '#a0aec0', fontSize: '0.875rem' }}>
            Loading announcements…
          </div>
        ) : tabFiltered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: dark ? '#4d8a6a' : '#a0aec0', fontSize: '0.875rem' }}>
            {announcements.length === 0 ? 'No announcements found.' : 'No results match your filter.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}` }}>
                  {['Title', 'Audience', 'Priority', 'Status', 'Schedule', ''].map((h) => (
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
                {tabFiltered.map((item, i) => (
                  <tr
                    key={item._id}
                    onClick={() => onRowClick(item)}
                    style={{
                      borderBottom: i < tabFiltered.length - 1 ? `1px solid ${dark ? '#1e3a2a' : '#f7f8fa'}` : 'none',
                      background: 'transparent',
                      transition: 'background 0.1s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = dark ? '#0d2619' : '#f0fdf4'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Title + preview + image thumbnail */}
                    <td style={{ padding: '12px 16px', maxWidth: 320 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {item.image?.url ? (
                          <img src={item.image.url} alt="" style={{
                            width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flexShrink: 0,
                            border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`,
                          }} />
                        ) : (
                          <div style={{
                            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                            background: dark ? '#0d2619' : '#d1fae5', color: dark ? '#4ade80' : '#059669',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M3 5h14M3 5v12a1 1 0 001 1h12a1 1 0 001-1V5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M7 10h6M7 13h4" strokeLinecap="round"/>
                            </svg>
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: dark ? '#eaf5f0' : '#111827' }}>
                            {item.title}
                          </div>
                          <div style={{
                            fontSize: '0.78rem', color: dark ? '#4d8a6a' : '#9ca3af', marginTop: 2,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240,
                          }}>
                            {item.content}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Audience */}
                    <td style={{ padding: '12px 16px' }}>
                      <AudienceBadge audience={item.audience} targetClients={item.targetClients} />
                    </td>

                    {/* Priority */}
                    <td style={{ padding: '12px 16px' }}>
                      <PriorityBadge priority={item.priority} />
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={item.status} />
                    </td>

                    {/* Schedule (start — end) */}
                    <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: dark ? '#4d8a6a' : '#9ca3af', whiteSpace: 'nowrap' }}>
                      {item.startDate || item.endDate ? (
                        <>{formatDate(item.startDate)} — {formatDate(item.endDate)}</>
                      ) : (
                        <span style={{ color: dark ? '#2a4a35' : '#d1d5db' }}>No schedule</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px 12px 8px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); onRowClick(item); }}
                          style={{
                            padding: '5px 14px', borderRadius: 6,
                            border: '1px solid #fbbf24', background: dark ? '#2a1f00' : '#fffbeb',
                            fontSize: '0.78rem', fontWeight: 600, color: dark ? '#fbbf24' : '#92400e', cursor: 'pointer',
                          }}
                        >
                          Details
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete && onDelete(item); }}
                          style={{
                            padding: '5px 12px', borderRadius: 6,
                            border: `1px solid ${dark ? '#7f1d1d' : '#fca5a5'}`,
                            background: dark ? '#1a0a0a' : '#fef2f2',
                            fontSize: '0.78rem', fontWeight: 600, color: dark ? '#f87171' : '#b91c1c', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 6h12M8 6V4h4v2M6 6v10a1 1 0 001 1h6a1 1 0 001-1V6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 16,
            padding: '12px 20px',
            borderTop: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}`,
          }}>
            <span style={{ fontSize: '0.78rem', color: dark ? '#4d8a6a' : '#9ca3af' }}>
              Page {page} of {totalPages} · {totalCount} {totalCount === 1 ? 'Announcement' : 'Announcements'}
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
