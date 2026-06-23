import { useTheme } from '../../../context/ThemeContext';
import { ViewToggle } from './AnnouncementsTable';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function ArchivesTable({
  announcements, loading, search, onSearchChange, onRefresh,
  onRestore, onRowClick,
  view, onViewChange,
  page, totalPages, totalCount, onPrev, onNext,
}) {
  const { dark } = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Top row: view toggle (right-aligned, same vertical position as tabs on main view) ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', marginBottom: 0 }}>
        <div style={{ paddingBottom: 6 }}>
          <ViewToggle view={view} onViewChange={onViewChange} />
        </div>
      </div>

      {/* ── White box ── */}
      <div style={{
        background: dark ? '#132a1e' : '#fff', borderRadius: 12,
        border: `1px solid ${dark ? '#1e3a2a' : '#e8ecf0'}`, overflow: 'visible',
        paddingBottom: 4, position: 'relative',
      }}>
        {/* Filter bar */}
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
              placeholder="Search archived…"
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
            {totalCount} archived
          </span>
          <button
            onClick={onRefresh}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 10px', borderRadius: 8,
              border: '1px solid #10b981', background: dark ? '#0d2619' : '#fff',
              fontSize: '0.82rem', fontWeight: 600, color: '#10b981',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4a8 8 0 0112.97 3M16 16a8 8 0 01-12.97-3" strokeLinecap="round" />
              <path d="M4 8V4H0" strokeLinecap="round" strokeLinejoin="round" transform="translate(4 0)" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: dark ? '#4d8a6a' : '#a0aec0', fontSize: '0.875rem' }}>
            Loading archives…
          </div>
        ) : announcements.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: dark ? '#4d8a6a' : '#a0aec0', fontSize: '0.875rem' }}>
            No archived announcements.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}` }}>
                  {['Title', 'Audience', 'Status', 'Archived On', 'Actions'].map((h) => (
                    <th key={h} style={{
                      padding: '10px 16px',
                      textAlign: h === 'Actions' ? 'right' : 'left',
                      fontSize: '0.72rem', fontWeight: 700,
                      color: dark ? '#4d8a6a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase',
                      whiteSpace: 'nowrap', background: 'transparent',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {announcements.map((item, i) => (
                  <tr
                    key={item._id}
                    style={{
                      borderBottom: i < announcements.length - 1 ? `1px solid ${dark ? '#1e3a2a' : '#f7f8fa'}` : 'none',
                      background: 'transparent', transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = dark ? '#0d2619' : '#f0fdf4'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 16px', maxWidth: 320 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {item.image?.url ? (
                          <img src={item.image.url} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}` }} />
                        ) : (
                          <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: dark ? '#0d2619' : '#d1fae5', color: dark ? '#4ade80' : '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 5h14M3 5v12a1 1 0 001 1h12a1 1 0 001-1V5" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 10h6M7 13h4" strokeLinecap="round"/></svg>
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: dark ? '#eaf5f0' : '#111827' }}>{item.title}</div>
                          <div style={{ fontSize: '0.78rem', color: dark ? '#4d8a6a' : '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{item.content}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {item.audience === 'selected' && item.targetClients?.length ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: dark ? '#1a1040' : '#e0e7ff', color: dark ? '#a78bfa' : '#4338ca', display: 'inline-block' }}>
                          {item.targetClients.length} client{item.targetClients.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: dark ? '#0d2619' : '#d1fae5', color: dark ? '#4ade80' : '#059669', display: 'inline-block' }}>All Clients</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: dark ? '#1a1a1a' : '#f3f4f6', color: dark ? '#9ca3af' : '#6b7280', display: 'inline-block' }}>Archived</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: dark ? '#4d8a6a' : '#9ca3af', whiteSpace: 'nowrap' }}>
                      {formatDate(item.updatedAt)}
                    </td>
                    <td style={{ padding: '12px 16px 12px 8px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRestore(item); }}
                        style={{
                          padding: '5px 14px', borderRadius: 6,
                          border: '1px solid #10b981', background: dark ? '#0d2619' : '#f0fdf4',
                          fontSize: '0.78rem', fontWeight: 600, color: dark ? '#4ade80' : '#059669', cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="6" width="16" height="11" rx="1.5"/><path d="M2 6l2-3h12l2 3" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 11h4M10 9v4" strokeLinecap="round"/>
                        </svg>
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}` }}>
            <span style={{ fontSize: '0.78rem', color: dark ? '#4d8a6a' : '#9ca3af' }}>
              Page {page} of {totalPages} · {totalCount} archived
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onPrev} disabled={page === 1} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`, background: page === 1 ? (dark ? '#0a1a10' : '#f9fafb') : (dark ? '#0d2619' : '#fff'), color: page === 1 ? (dark ? '#2a4a35' : '#d1d5db') : (dark ? '#7ab89a' : '#374151'), fontSize: '0.82rem', fontWeight: 600, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Prev
              </button>
              <button onClick={onNext} disabled={page === totalPages} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`, background: page === totalPages ? (dark ? '#0a1a10' : '#f9fafb') : (dark ? '#0d2619' : '#fff'), color: page === totalPages ? (dark ? '#2a4a35' : '#d1d5db') : (dark ? '#7ab89a' : '#374151'), fontSize: '0.82rem', fontWeight: 600, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
                Next
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
