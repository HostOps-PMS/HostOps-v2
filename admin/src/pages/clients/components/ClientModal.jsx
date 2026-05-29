import { useState } from 'react';
import { updateClient } from '../services/clientsService';
import ClientSmoobuView from './ClientSmoobuView';

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

export default function ClientModal({ client, onClose, onUpdated }) {
  if (!client) return null;

  const [isEditing,   setIsEditing]   = useState(false);
  const [showSmoobu,  setShowSmoobu]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState(null);

  const [form, setForm] = useState({
    role:              client.role              ?? 'client',
    propertyTagPrefix: client.propertyTagPrefix ?? '',
    smoobuApiKey:      '',
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleEditToggle() {
    setSaveError(null);
    setForm({
      role:              client.role              ?? 'client',
      propertyTagPrefix: client.propertyTagPrefix ?? '',
      smoobuApiKey:      '',
    });
    setIsEditing(true);
  }

  function handleCancel() {
    setSaveError(null);
    setIsEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        role:              form.role,
        propertyTagPrefix: form.propertyTagPrefix,
      };
      if (form.smoobuApiKey.trim()) {
        payload.smoobuApiKey = form.smoobuApiKey.trim();
      }
      const updated = await updateClient(client._id, payload);
      setIsEditing(false);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      setSaveError(err.message ?? 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="db-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="db-modal">
          {/* Header */}
          <div className="db-modal__head">
            <span className="db-modal__title">
              {isEditing ? 'Edit Business' : 'Business Details'}
            </span>
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

            {/* Error banner */}
            {saveError && (
              <div style={{
                background: '#fee2e2', color: '#b91c1c',
                borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                fontSize: '.8125rem', fontWeight: 500, marginBottom: 12,
              }}>
                ⚠️ {saveError}
              </div>
            )}

            {isEditing ? (
              /* ── Edit form ── */
              <div className="cl-modal-edit-form">
                <div className="cl-modal-field">
                  <label className="cl-modal-field__label" htmlFor="edit-role">Role</label>
                  <select
                    id="edit-role"
                    name="role"
                    className="cl-edit-select"
                    value={form.role}
                    onChange={handleChange}
                  >
                    <option value="client">Client</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="cl-modal-field">
                  <label className="cl-modal-field__label" htmlFor="edit-prefix">
                    Property Tag Prefix
                  </label>
                  <input
                    id="edit-prefix"
                    name="propertyTagPrefix"
                    type="text"
                    className="cl-edit-input"
                    placeholder="e.g. charmaine_"
                    value={form.propertyTagPrefix}
                    onChange={handleChange}
                    maxLength={100}
                  />
                </div>

                <div className="cl-modal-field">
                  <label className="cl-modal-field__label" htmlFor="edit-smoobu">
                    Smoobu API Key
                  </label>
                  <input
                    id="edit-smoobu"
                    name="smoobuApiKey"
                    type="password"
                    className="cl-edit-input"
                    placeholder="Leave blank to keep existing key"
                    value={form.smoobuApiKey}
                    onChange={handleChange}
                    maxLength={512}
                    autoComplete="new-password"
                  />
                  <span style={{ fontSize: '.75rem', color: 'var(--color-muted)', marginTop: 4, display: 'block' }}>
                    Only fill this in if you want to set or replace the key.
                  </span>
                </div>
              </div>
            ) : (
              /* ── Read-only details ── */
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
                <Field label="Last Login"           value={formatDate(client.lastLoginAt)} />
                <Field label="Joined"               value={formatDate(client.createdAt)} />
                <Field label="Updated At"           value={formatDate(client.updatedAt)} />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="db-modal__foot">
            {isEditing ? (
              <>
                <button className="db-btn db-btn--ghost" onClick={handleCancel} disabled={saving}>
                  Cancel
                </button>
                <button className="db-btn db-btn--primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <button className="db-btn db-btn--ghost" onClick={onClose}>
                  Close
                </button>
                <button
                  className="db-btn db-btn--ghost"
                  onClick={() => setShowSmoobu(true)}
                  title="View Smoobu data for this business"
                >
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                    <circle cx="10" cy="10" r="3" />
                    <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" />
                  </svg>
                  View Smoobu
                </button>
                <button className="db-btn db-btn--primary" onClick={handleEditToggle}>
                  Edit
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Smoobu data view — rendered on top of ClientModal */}
      {showSmoobu && (
        <ClientSmoobuView
          client={client}
          onClose={() => setShowSmoobu(false)}
        />
      )}
    </>
  );
}