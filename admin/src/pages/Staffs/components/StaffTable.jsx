import { useState } from 'react';
import Badge from './Badge';
import PropertyPills from './PropertyPills';

export default function StaffTable({
  staffs,
  clients,
  filtered,
  loading,
  error,
  search,
  filterClient,
  propertyMap,
  onSearchChange,
  onFilterClientChange,
  onEdit,
  onDelete,
  onNew,
}) {
  const clientMap = Object.fromEntries(clients.map((c) => [c._id, c]));

  const [selected, setSelected] = useState([]);
  const [activeTab, setActiveTab] = useState('All');

const TAB_ICONS = {
    All: (
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round"/>
      </svg>
    ),
    Active: (
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="2,12 5,8 8,11 12,6 15,9 18,5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    Inactive: (
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="10" cy="10" r="7"/>
        <path d="M10 7v3M10 13h.01" strokeLinecap="round"/>
      </svg>
    ),
  };

  const tabs = [
    { label: 'All', count: staffs.length },
    { label: 'Active', count: staffs.filter(s => s.isActive).length },
    { label: 'Inactive', count: staffs.filter(s => !s.isActive).length },
  ];

  const tabFiltered = activeTab === 'All' ? filtered
    : activeTab === 'Active' ? filtered.filter(s => s.isActive)
    : filtered.filter(s => !s.isActive);

  const allChecked = tabFiltered.length > 0 && tabFiltered.every(s => selected.includes(s._id));

  function toggleAll() {
    if (allChecked) setSelected([]);
    else setSelected(tabFiltered.map(s => s._id));
  }

  function toggleOne(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Top header: tab bar + New Staff button */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 0, flexWrap: 'wrap', gap: 10, paddingBottom: 0,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'flex-end', gap: 0,
          background: 'transparent',
          padding: '0 0 0 0', marginBottom: '-1px',
        }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.label;
            return (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px 9px', border: '1px solid',
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
      <div style={{ background: '#fff', borderRadius: '0 12px 12px 12px', border: '1px solid #e8ecf0', overflow: 'visible', paddingBottom: 4, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px 14px', borderBottom: '1px solid #f0f2f5', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 280 }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter staff…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '7px 12px 7px 32px',
              borderRadius: 8, border: '1px solid #e5e7eb',
              fontSize: '0.83rem', outline: 'none', background: '#fafafa',
              color: '#1a202c',
            }}
          />
        </div>
        <select
          value={filterClient}
          onChange={(e) => onFilterClientChange(e.target.value)}
          style={{
            padding: '7px 14px', borderRadius: 8,
            border: '1px solid #e5e7eb', fontSize: '0.83rem',
            outline: 'none', background: '#fafafa', cursor: 'pointer', color: '#4a5568',
          }}
        >
          <option value="">All Businesses</option>
          {clients.map((c) => (
            <option key={c._id} value={c._id}>{c.businessName}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.78rem', color: '#9ca3af', marginLeft: 'auto' }}>
          {tabFiltered.length} staff{tabFiltered.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onNew}
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
          + New Staff
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fff0ee', color: '#c13515', padding: '10px 20px', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#a0aec0', fontSize: '0.875rem' }}>
          Loading staffs…
        </div>
      ) : tabFiltered.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#a0aec0', fontSize: '0.875rem' }}>
          {staffs.length === 0 ? 'No staff accounts yet. Create one to get started.' : 'No results match your search.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f0f2f5' }}>
                <th style={{ padding: '10px 16px 10px 20px', width: 36 }}>
                  <input type="checkbox" checked={allChecked} onChange={toggleAll}
                    style={{ width: 15, height: 15, accentColor: '#3b5fc0', cursor: 'pointer' }} />
                </th>
                {['Staff', 'Business', 'Properties', 'Status', 'Created', ''].map((h) => (
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
              {tabFiltered.map((s, i) => {
                const client = clientMap[s.clientId?._id || s.clientId];
                const isSelected = selected.includes(s._id);
                return (
                  <tr
                    key={s._id}
                    style={{
                      borderBottom: i < tabFiltered.length - 1 ? '1px solid #f7f8fa' : 'none',
                      background: isSelected ? '#f8f9ff' : 'transparent',
                      borderLeft: isSelected ? '3px solid #3b5fc0' : '3px solid transparent',
                      transition: 'background 0.1s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#fafbff'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 16px 12px 20px', width: 36 }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleOne(s._id)}
                        style={{ width: 15, height: 15, accentColor: '#3b5fc0', cursor: 'pointer' }} />
                    </td>

                    {/* Staff name + email */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
                        {s.firstName} {s.lastName}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>{s.email}</div>
                      {s.mustChangePassword && (
                        <span style={{
                          fontSize: '0.68rem', background: '#fff8e1', color: '#7a6a00',
                          padding: '1px 6px', borderRadius: 4, fontWeight: 600,
                          marginTop: 3, display: 'inline-block',
                        }}>
                          Must change PIN
                        </span>
                      )}
                    </td>

                    {/* Client */}
                    <td style={{ padding: '12px 16px', fontSize: '0.83rem', color: '#4a5568' }}>
                      {client ? client.businessName : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>

                    {/* Properties */}
                    <td style={{ padding: '12px 16px', maxWidth: 260 }}>
                      <PropertyPills propertyIds={s.propertyIds} propertyMap={propertyMap} />
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <Badge active={s.isActive} />
                    </td>

                    {/* Created */}
                    <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px 12px 8px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => onEdit(s)} style={{
                          padding: '5px 14px', borderRadius: 6,
                          border: '1px solid #e5e7eb', background: '#fff',
                          fontSize: '0.78rem', fontWeight: 600, color: '#374151', cursor: 'pointer',
                        }}>
                          Edit
                        </button>
                        <button onClick={() => onDelete(s)} style={{
                          padding: '5px 14px', borderRadius: 6,
                          border: '1px solid #fecaca', background: '#fff5f5',
                          fontSize: '0.78rem', fontWeight: 600, color: '#dc2626', cursor: 'pointer',
                        }}>
                          Delete
                        </button>
                        <button style={{
                          padding: '5px 8px', borderRadius: 6,
                          border: '1px solid #e5e7eb', background: '#fff',
                          fontSize: '0.9rem', color: '#9ca3af', cursor: 'pointer',
                          display: 'flex', alignItems: 'center',
                        }}>
                          ···
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
    </div>
    </div>
  );
}