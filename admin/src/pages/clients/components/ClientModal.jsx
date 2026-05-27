function initials(firstName = '', lastName = '') {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '?';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Field({ label, value }) {
  return (
    <div className="cl-modal-field">
      <span className="cl-modal-field__label">{label}</span>
      <span className="cl-modal-field__value">{value || '—'}</span>
    </div>
  );
}

export default function ClientModal({ client, onClose }) {
  if (!client) return null;

  return (
    <div className="db-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="db-modal">
        {/* Header */}
        <div className="db-modal__head">
          <span className="db-modal__title">Client Details</span>
          <button className="db-modal__close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="db-modal__body">
          {/* Profile row */}
          <div className="cl-modal-profile">
            <div className="cl-modal-profile__avatar">
              {initials(client.firstName, client.lastName)}
            </div>
            <div>
              <div className="cl-modal-profile__name">
                {client.firstName} {client.lastName}
              </div>
              <div className="cl-modal-profile__email">{client.email}</div>
            </div>
          </div>

          {/* Details grid */}
          <div className="cl-modal-grid">
            <Field label="Role" value={
              <span className={`db-badge ${client.role === 'admin' ? 'db-badge--info' : 'db-badge--neutral'}`}>
                {client.role}
              </span>
            } />
            <Field label="Email Status" value={
              <span className={`db-badge ${client.isVerified ? 'db-badge--success' : 'db-badge--warning'}`}>
                {client.isVerified ? '✓ Verified' : 'Unverified'}
              </span>
            } />
            <Field label="Property Tag Prefix" value={client.propertyTagPrefix || '—'} />
            <Field label="Smoobu" value={
              client.smoobuConnectedAt
                ? <span className="db-badge db-badge--success">Connected</span>
                : <span className="db-badge db-badge--neutral">Not connected</span>
            } />
            <Field label="Smoobu Connected At" value={formatDate(client.smoobuConnectedAt)} />
            <Field label="Last Login" value={formatDate(client.lastLoginAt)} />
            <Field label="Joined" value={formatDate(client.createdAt)} />
            <Field label="Updated At" value={formatDate(client.updatedAt)} />
          </div>
        </div>

        {/* Footer */}
        <div className="db-modal__foot">
          <button className="db-btn db-btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
