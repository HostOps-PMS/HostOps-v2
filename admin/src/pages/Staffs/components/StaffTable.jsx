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
}) {
  const clientMap = Object.fromEntries(clients.map((c) => [c._id, c]));

  return (
    <>
      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or email…"
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1.5px solid #e2e8f0',
            fontSize: '0.875rem',
            outline: 'none',
            minWidth: 220,
            background: '#fafafa',
          }}
        />
        <select
          value={filterClient}
          onChange={(e) => onFilterClientChange(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1.5px solid #e2e8f0',
            fontSize: '0.875rem',
            outline: 'none',
            background: '#fafafa',
            cursor: 'pointer',
          }}
        >
          <option value="">All Businesses</option>
          {clients.map((c) => (
            <option key={c._id} value={c._id}>
              {c.businessName}
            </option>
          ))}
        </select>
        <span style={{ fontSize: '0.8rem', color: '#718096', marginLeft: 'auto' }}>
          {filtered.length} staff{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: '#fff0ee',
            color: '#c13515',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: '0.875rem',
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e8ecf0',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#a0aec0', fontSize: '0.875rem' }}>
            Loading staffs…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#a0aec0', fontSize: '0.875rem' }}>
            {staffs.length === 0 ? 'No staff accounts yet. Create one to get started.' : 'No results match your search.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f8fa', borderBottom: '1px solid #e8ecf0' }}>
                {['Staff', 'Business', 'Properties', 'Status', 'Created', ''].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '11px 16px',
                      textAlign: 'left',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#718096',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const client = clientMap[s.clientId?._id || s.clientId];
                return (
                  <tr
                    key={s._id}
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid #f0f0f0' : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbff')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Staff name + email */}
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1a202c' }}>
                        {s.firstName} {s.lastName}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#718096', marginTop: 2 }}>
                        {s.email}
                      </div>
                      {s.mustChangePassword && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            background: '#fff8e1',
                            color: '#7a6a00',
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontWeight: 600,
                            marginTop: 3,
                            display: 'inline-block',
                          }}
                        >
                          Must change PIN
                        </span>
                      )}
                    </td>

                    {/* Client */}
                    <td style={{ padding: '13px 16px', fontSize: '0.83rem', color: '#4a5568' }}>
                      {client ? client.businessName : <span style={{ color: '#aaa' }}>—</span>}
                    </td>

                    {/* Properties */}
                    <td style={{ padding: '13px 16px', maxWidth: 260 }}>
                      <PropertyPills propertyIds={s.propertyIds} propertyMap={propertyMap} />
                    </td>

                    {/* Status */}
                    <td style={{ padding: '13px 16px' }}>
                      <Badge active={s.isActive} />
                    </td>

                    {/* Created */}
                    <td style={{ padding: '13px 16px', fontSize: '0.78rem', color: '#a0aec0', whiteSpace: 'nowrap' }}>
                      {new Date(s.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => onEdit(s)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 6,
                            border: '1.5px solid #e2e8f0',
                            background: '#fff',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: '#2d3748',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(s)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 6,
                            border: '1.5px solid #fcd5d5',
                            background: '#fff5f5',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: '#c53030',
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}