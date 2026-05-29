function initials(firstName = '', lastName = '') {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '?';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function VerifiedBadge({ isVerified }) {
  return isVerified
    ? <span className="db-badge db-badge--success">✓ Verified</span>
    : <span className="db-badge db-badge--warning">Unverified</span>;
}

function RoleBadge({ role }) {
  if (role === 'admin') return <span className="db-badge db-badge--info">Admin</span>;
  if (role === 'team_leader') return <span className="db-badge" style={{background: '#e0e7ff', color: '#4338ca', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600}}>Team Leader</span>;
  return <span className="db-badge db-badge--neutral">Client</span>;
}

function SmoobuBadge({ connected }) {
  return connected
    ? <span className="db-badge db-badge--success">Connected</span>
    : <span className="db-badge db-badge--neutral">—</span>;
}

function SkeletonRow() {
  return (
    <tr>
      {[220, 100, 80, 90, 100, 100].map((w, i) => (
        <td key={i}>
          <div className="db-skeleton" style={{ height: 14, width: w }} />
        </td>
      ))}
    </tr>
  );
}

export default function ClientsTable({ clients, loading, onRowClick }) {
  return (
    <div className="cl-table-card">
      <div className="cl-table-card__head">
        <h2 className="cl-table-card__title">All Businesses</h2>
        {!loading && (
          <span className="cl-table-card__count">
            {clients.length} {clients.length === 1 ? 'Business' : 'Businesses'}
          </span>
        )}
      </div>

      <div className="cl-table-wrapper">
        <table className="cl-table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Role</th>
              <th>Status</th>
              <th>Smoobu</th>
              <th>Last Login</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              : clients.length === 0
                ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="cl-empty">
                        <div className="cl-empty__icon">👥</div>
                        <div className="cl-empty__text">No Businesses found</div>
                      </div>
                    </td>
                  </tr>
                )
                : clients.map((client) => (
                  <tr key={client._id} onClick={() => onRowClick(client)}>
                    <td>
                      <div className="cl-name-cell">
                        <div className="cl-avatar">
                          {initials(client.firstName, client.lastName)}
                        </div>
                        <div>
                          <div className="cl-name-cell__name">
                            {client.firstName} {client.lastName}
                          </div>
                          <div className="cl-name-cell__email">{client.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><RoleBadge role={client.role} /></td>
                    <td><VerifiedBadge isVerified={client.isVerified} /></td>
                    <td><SmoobuBadge connected={!!client.smoobuConnectedAt} /></td>
                    <td style={{ color: 'var(--color-muted)' }}>
                      {formatDate(client.lastLoginAt)}
                    </td>
                    <td style={{ color: 'var(--color-muted)' }}>
                      {formatDate(client.createdAt)}
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}