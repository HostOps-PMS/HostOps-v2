import { useState } from 'react';

function initials(businessName = '') {
  const parts = businessName.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? '').toUpperCase() || '?';
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase() || '?';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function VerifiedBadge({ client }) {
  if (client.mustChangePassword && client.mustChangePin) {
    return (
      <span style={{
        fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
        background: '#fff8e1', color: '#7a6a00', display: 'inline-block',
      }}>Unverified</span>
    );
  } else if (!client.mustChangePassword && !client.mustChangePin) {
    return (
      <span style={{
        fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
        background: '#f0fdf4', color: '#16a34a', display: 'inline-block',
      }}>✓ Verified</span>
    );
  } else {
    return (
      <span style={{
        fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
        background: '#eff6ff', color: '#2563eb', display: 'inline-block',
      }}>Partially Verified</span>
    );
  }
}

function RoleBadge({ role }) {
  if (role === 'admin') return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: '#eff6ff', color: '#2563eb', display: 'inline-block',
    }}>Admin</span>
  );
  if (role === 'team_leader') return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: '#e0e7ff', color: '#4338ca', display: 'inline-block',
    }}>Team Leader</span>
  );
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: '#f3f4f6', color: '#6b7280', display: 'inline-block',
    }}>Client</span>
  );
}

const TAB_ICONS = {
  All: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
    </svg>
  ),
  Verified: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="2,12 5,8 8,11 12,6 15,9 18,5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Partial: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 10V7" strokeLinecap="round" />
    </svg>
  ),
  Unverified: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 7v3M10 13h.01" strokeLinecap="round" />
    </svg>
  ),
};

function isVerified(client) {
  return !client.mustChangePassword && !client.mustChangePin;
}

function isPartial(client) {
  return (client.mustChangePassword && !client.mustChangePin) ||
         (!client.mustChangePassword && client.mustChangePin);
}

function isUnverified(client) {
  return client.mustChangePassword && client.mustChangePin;
}

export default function ClientsTable({ clients, loading, onRowClick, search, onSearchChange, onAddClient, onRefresh, page, totalPages, totalCount, onPrev, onNext }) {
  const [activeTab, setActiveTab] = useState('All');
  const [selected, setSelected] = useState([]);

  const tabs = [
    { label: 'All', count: clients.length },
    { label: 'Verified', count: clients.filter(isVerified).length },
    { label: 'Partial', count: clients.filter(isPartial).length },
    { label: 'Unverified', count: clients.filter(isUnverified).length },
  ];

  const tabFiltered =
    activeTab === 'All' ? clients
    : activeTab === 'Verified' ? clients.filter(isVerified)
    : activeTab === 'Partial' ? clients.filter(isPartial)
    : clients.filter(isUnverified);

  const allChecked =
    tabFiltered.length > 0 && tabFiltered.every((c) => selected.includes(c._id));

  function toggleAll() {
    if (allChecked) setSelected([]);
    else setSelected(tabFiltered.map((c) => c._id));
  }

  function toggleOne(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 0, flexWrap: 'wrap', gap: 10, paddingBottom: 0,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'flex-end', gap: 0,
          background: 'transparent', marginBottom: '-1px',
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
                  borderColor: isActive ? '#e8ecf0' : 'transparent',
                  borderBottom: isActive ? '1px solid #fff' : 'none',
                  borderRadius: '10px 10px 0 0',
                  background: isActive ? '#fff' : 'transparent',
                  marginBottom: '-1px',
                  cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                  color: isActive ? '#10b981' : '#9ca3af',
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

      {/* Filter bar + table */}
      <div style={{
        background: '#fff', borderRadius: '0 12px 12px 12px',
        border: '1px solid #e8ecf0', overflow: 'visible',
        paddingBottom: 4, position: 'relative',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 20px 14px', borderBottom: '1px solid #f0f2f5', flexWrap: 'wrap',
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 280 }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name or email…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '7px 12px 7px 32px',
                borderRadius: 8, border: '1px solid #e5e7eb',
                fontSize: '0.83rem', outline: 'none', background: '#fafafa',
                color: '#1a202c',
              }}
            />
          </div>
          <span style={{ fontSize: '0.78rem', color: '#9ca3af', marginLeft: 'auto' }}>
            {tabFiltered.length} {tabFiltered.length === 1 ? 'Business' : 'Businesses'}
          </span>
          <button
            onClick={onRefresh}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid #10b981', background: '#fff',
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
          <button
            onClick={onAddClient}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '7px 16px', borderRadius: 999,
              border: 'none', background: '#10b981',
              color: '#fff', fontSize: '0.82rem', fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(59,95,192,0.18)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#059669'}
            onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
          >
            + Add Business
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#a0aec0', fontSize: '0.875rem' }}>
            Loading businesses…
          </div>
        ) : tabFiltered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#a0aec0', fontSize: '0.875rem' }}>
            {clients.length === 0 ? 'No businesses found.' : 'No results match your filter.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f2f5' }}>
                  <th style={{ padding: '10px 16px 10px 20px', width: 36 }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      style={{ width: 15, height: 15, accentColor: '#10b981', cursor: 'pointer' }}
                    />
                  </th>
                  {['Business', 'Role', 'Status', 'Last Login', 'Joined'].map((h) => (
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
                {tabFiltered.map((client, i) => {
                  const isSelected = selected.includes(client._id);
                  return (
                    <tr
                      key={client._id}
                      onClick={() => onRowClick(client)}
                      style={{
                        borderBottom: i < tabFiltered.length - 1 ? '1px solid #f7f8fa' : 'none',
                        background: isSelected ? '#f0fdf4' : 'transparent',
                        borderLeft: isSelected ? '3px solid #10b981' : '3px solid transparent',
                        transition: 'background 0.1s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f0fdf4'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td
                        style={{ padding: '12px 16px 12px 20px', width: 36 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(client._id)}
                          style={{ width: 15, height: 15, accentColor: '#10b981', cursor: 'pointer' }}
                        />
                      </td>

                      {/* Business name + email + avatar */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                            background: '#d1fae5', color: '#059669',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.03em',
                          }}>
                            {initials(client.businessName)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
                              {client.businessName}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>
                              {client.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td style={{ padding: '12px 16px' }}>
                        <RoleBadge role={client.role} />
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <VerifiedBadge client={client} />
                      </td>

                      {/* Last Login */}
                      <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {formatDate(client.lastLoginAt)}
                      </td>

                      {/* Joined */}
                      <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {formatDate(client.createdAt)}
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
            borderTop: '1px solid #f0f2f5',
          }}>
            <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
              Page {page} of {totalPages} · {totalCount} {totalCount === 1 ? 'Business' : 'Businesses'}
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
                  transition: 'background 0.15s',
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
                  transition: 'background 0.15s',
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