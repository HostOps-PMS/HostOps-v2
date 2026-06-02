import { useState, useEffect, useCallback } from 'react';
import { updateClient, getClientSmoobuData } from '../services/clientsService';
import ClientSmoobuView from './ClientSmoobuView';

function initials(businessName = '') {
  const parts = businessName.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? '').toUpperCase() || '?';
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase() || '?';
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

// ── Properties panel ──────────────────────────────────────────────
// Shown in read-only mode. Fetches the client's properties and lets
// the admin drill into Smoobu data for each one.
function PropertiesPanel({ clientId, onViewSmoobu }) {
  const [properties, setProperties] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const BASE   = import.meta.env.VITE_API_BASE_URL ?? '';
      const token  = sessionStorage.getItem('hp_access_token');
      const apiKey = import.meta.env.VITE_API_KEY ?? '';
      const res = await fetch(`${BASE}/api/clients/${clientId}/properties`, {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
          ...(token  ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setProperties(await res.json());
    } catch (err) {
      setError(err.message ?? 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2].map((i) => (
          <div key={i} className="db-skeleton" style={{ height: 48, borderRadius: 'var(--radius-sm)' }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontSize: '.8125rem', color: 'var(--color-danger)', padding: '8px 0' }}>
        ⚠️ {error}
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div style={{
        fontSize: '.8125rem', color: 'var(--color-muted)',
        padding: '12px 0', fontStyle: 'italic',
      }}>
        No properties yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {properties.map((p) => (
        <div
          key={p._id}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'var(--color-surface-2, #f0f7f4)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div>
            <div style={{ fontSize: '.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
              {p.name}
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--color-muted)', marginTop: 2, display: 'flex', gap: 10 }}>
              <span>
                {p.smoobuConnectedAt
                  ? <span style={{ color: 'var(--color-success, #26a676)' }}>● Smoobu connected</span>
                  : <span>○ No Smoobu key</span>
                }
              </span>
              {p.subProperties?.length > 0 && (
                <span>{p.subProperties.length} sub-propert{p.subProperties.length === 1 ? 'y' : 'ies'}</span>
              )}
            </div>
          </div>
          {p.smoobuConnectedAt && (
            <button
              className="db-btn db-btn--ghost"
              style={{ fontSize: '.75rem', padding: '4px 10px' }}
              onClick={() => onViewSmoobu(p)}
            >
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                <circle cx="10" cy="10" r="3" />
                <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" />
              </svg>
              View
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function ClientModal({ client, onClose, onUpdated }) {
  if (!client) return null;

  const [isEditing,        setIsEditing]        = useState(false);
  const [smoobuProperty,   setSmoobuProperty]   = useState(null); // property to view in SmoobuView
  const [saving,           setSaving]           = useState(false);
  const [saveError,        setSaveError]        = useState(null);

  const [form, setForm] = useState({
    businessName:      client.businessName      ?? '',
    role:              client.role              ?? 'client',
    propertyTagPrefix: client.propertyTagPrefix ?? '',
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleEditToggle() {
    setSaveError(null);
    setForm({
      businessName:      client.businessName      ?? '',
      role:              client.role              ?? 'client',
      propertyTagPrefix: client.propertyTagPrefix ?? '',
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
        businessName:      form.businessName,
        role:              form.role,
        propertyTagPrefix: form.propertyTagPrefix,
      };
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
                {initials(client.businessName)}
              </div>
              <div>
                <div className="cl-modal-profile__name">
                  {client.businessName}
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
                  <label className="cl-modal-field__label" htmlFor="edit-businessName">Business Name</label>
                  <input
                    id="edit-businessName"
                    name="businessName"
                    type="text"
                    className="cl-edit-input"
                    placeholder="e.g. Acme Properties Inc."
                    value={form.businessName}
                    onChange={handleChange}
                    maxLength={150}
                  />
                </div>

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

                <div style={{
                  background: 'var(--color-surface-2, #f0f7f4)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  fontSize: '.8125rem',
                  color: 'var(--color-muted)',
                }}>
                  💡 To manage Smoobu API keys, go to the Properties section of this business account.
                </div>
              </div>
            ) : (
              /* ── Read-only details ── */
              <>
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
                  <Field label="Last Login"           value={formatDate(client.lastLoginAt)} />
                  <Field label="Joined"               value={formatDate(client.createdAt)} />
                  <Field label="Updated At"           value={formatDate(client.updatedAt)} />
                </div>

                {/* Properties section */}
                <div style={{ marginTop: 16 }}>
                  <div style={{
                    fontSize: '.8125rem', fontWeight: 600,
                    color: 'var(--color-muted)', textTransform: 'uppercase',
                    letterSpacing: '.05em', marginBottom: 10,
                  }}>
                    Properties
                  </div>
                  <PropertiesPanel
                    clientId={client._id}
                    onViewSmoobu={(property) => setSmoobuProperty(property)}
                  />
                </div>
              </>
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
                <button className="db-btn db-btn--primary" onClick={handleEditToggle}>
                  Edit
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Smoobu data view — rendered on top of ClientModal */}
      {smoobuProperty && (
        <ClientSmoobuView
          client={client}
          property={smoobuProperty}
          onClose={() => setSmoobuProperty(null)}
        />
      )}
    </>
  );
}