import { useState, useEffect, useCallback } from 'react';
import { updateClient, getClientSmoobuData, createClientProperty, updateClientProperty, deleteClientProperty, getClientPropertyApiKey } from '../services/clientsService';
import ClientSmoobuView from './ClientSmoobuView';
import OTPModal from '../../../components/OTPModal';
import { sendLoginOtp } from '../../authorization/services/authService';

function mapPropertiesForEdit(properties = []) {
  return properties.map((p) => ({
    _id: p._id,
    name: p.propertyName || p.name || '',
    hasSmoobuKey: !!p.hasSmoobuKey,
    maskedSmoobuApiKey: p.maskedSmoobuApiKey || '',
    smoobuApiKey: p.maskedSmoobuApiKey || '',
    isUnmasked: false,
  }));
}

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

function Divider({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      margin: '8px 0',
    }}>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border, #e5e9ec)' }} />
      <span style={{
        fontSize: '.6875rem', fontWeight: 600, letterSpacing: '.06em',
        color: 'var(--color-muted)', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border, #e5e9ec)' }} />
    </div>
  );
}

// ── Properties panel ──────────────────────────────────────────────
function PropertiesPanel({ properties, loading, error, onViewSmoobu }) {
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
              {p.propertyName || p.name}
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--color-muted)', marginTop: 2, display: 'flex', gap: 10 }}>
              <span>
                {p.hasSmoobuKey
                  ? <span style={{ color: 'var(--color-success, #26a676)' }}>● Smoobu connected</span>
                  : <span>○ No Smoobu key</span>
                }
              </span>
              {p.subProperties?.length > 0 && (
                <span>{p.subProperties.length} sub-propert{p.subProperties.length === 1 ? 'y' : 'ies'}</span>
              )}
            </div>
          </div>
          {p.hasSmoobuKey && (
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

export default function ClientModal({ client, onClose, onUpdated }) {
  if (!client) return null;

  const [isEditing,        setIsEditing]        = useState(false);
  const [smoobuProperty,   setSmoobuProperty]   = useState(null);
  const [saving,           setSaving]           = useState(false);
  const [saveError,        setSaveError]        = useState(null);
  const [otpAction,        setOtpAction]        = useState(null);

  const [properties, setProperties] = useState([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [propsError, setPropsError] = useState(null);

  const [form, setForm] = useState({
    businessName:      client.businessName      ?? '',
    role:              client.role              ?? 'client',
    propertyTagPrefix: client.propertyTagPrefix ?? '',
    password:          '',
    pin:               '',
    properties:        []
  });

  const loadProperties = useCallback(async () => {
    setLoadingProps(true);
    setPropsError(null);
    try {
      const BASE   = import.meta.env.VITE_API_BASE_URL ?? '';
      const token  = sessionStorage.getItem('hp_access_token');
      const apiKey = import.meta.env.VITE_API_KEY ?? '';
      const res = await fetch(`${BASE}/api/clients/${client._id}/properties`, {
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
      setPropsError(err.message ?? 'Failed to load properties');
    } finally {
      setLoadingProps(false);
    }
  }, [client._id]);

  useEffect(() => { loadProperties(); }, [loadProperties]);

  useEffect(() => {
    if (!isEditing) return;
    setForm((prev) => ({
      ...prev,
      properties: mapPropertiesForEdit(properties),
    }));
  }, [isEditing, properties]);

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
      password:          '',
      pin:               '',
      properties:        mapPropertiesForEdit(properties)
    });
    setIsEditing(true);
  }

  function handleCancel() {
    setSaveError(null);
    setIsEditing(false);
  }

  const setProp = (index, key) => (e) => {
    const val = e.target.value;
    setForm((f) => ({
      ...f,
      properties: f.properties.map((p, i) => (i === index ? { ...p, [key]: val } : p))
    }));
  };

  const addProperty = () =>
    setForm(f => ({ ...f, properties: [...f.properties, { name: '', smoobuApiKey: '' }] }));

  const removeProperty = (index) => {
    if (window.confirm("Are you sure you will remove this property?")) {
      setOtpAction({ type: 'remove-prop', index });
      sendLoginOtp().catch(err => alert(err.message));
    }
  };

  const showApiKey = (index, propertyId) => {
    if (window.confirm("Proceed in showing the API key?")) {
      setOtpAction({ type: 'show-key', index, propertyId });
      sendLoginOtp().catch(err => alert(err.message));
    }
  };

  const handleOtpVerified = async (otp) => {
    try {
      if (otpAction?.type === 'remove-prop') {
        setForm(f => ({ ...f, properties: f.properties.filter((_, i) => i !== otpAction.index) }));
      } else if (otpAction?.type === 'show-key') {
        const res = await getClientPropertyApiKey(client._id, otpAction.propertyId);
        setForm(f => ({
          ...f,
          properties: f.properties.map((p, i) => (
            i === otpAction.index ? { ...p, smoobuApiKey: res.smoobuApiKey, isUnmasked: true } : p
          ))
        }));
      }
    } catch (err) {
      alert(err.message || 'Error executing action');
    } finally {
      setOtpAction(null);
    }
  };


  async function handleSave() {
    if (form.password && form.password.length < 8) {
      setSaveError('Password must be at least 8 characters.');
      return;
    }
    if (form.pin && !/^\d{6}$/.test(form.pin)) {
      setSaveError('PIN must be exactly 6 digits.');
      return;
    }
    for (let i = 0; i < form.properties.length; i++) {
      if (!form.properties[i].name.trim()) {
        setSaveError(`Property ${i + 1} name is required.`);
        return;
      }
    }

    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        businessName:      form.businessName,
        role:              form.role,
        propertyTagPrefix: form.propertyTagPrefix,
      };
      if (form.password) payload.password = form.password;
      if (form.pin)      payload.pin      = form.pin;

      const updated = await updateClient(client._id, payload);

      // Handle properties
      const existingIds = new Set(properties.map(p => p._id));
      const formIds = new Set(form.properties.filter(p => p._id).map(p => p._id));

      // 1. Delete removed properties
      for (const old of properties) {
        if (!formIds.has(old._id)) {
          await deleteClientProperty(client._id, old._id);
        }
      }

      // 2. Create/Update properties
      for (const p of form.properties) {
        if (p._id) {
          // Update only if changed
          const oldProp = properties.find(x => x._id === p._id);
          const isMasked = p.smoobuApiKey === p.maskedSmoobuApiKey && p.smoobuApiKey.includes('•');
          const finalKey = isMasked ? '' : p.smoobuApiKey.trim();
          const needsUpdate = (oldProp.propertyName !== p.name) || finalKey;
          if (needsUpdate) {
            await updateClientProperty(client._id, p._id, {
              propertyName: p.name.trim(),
              ...(finalKey ? { smoobuApiKey: finalKey } : {})
            });
          }
        } else {
          // Create new
          await createClientProperty(client._id, {
            propertyName: p.name.trim(),
            smoobuApiKey: p.smoobuApiKey.trim() || ''
          });
        }
      }

      await loadProperties();
      setIsEditing(false);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      setSaveError(err.message ?? 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  // Calculate status
  let statusBadge = null;
  if (client.mustChangePassword && client.mustChangePin) {
    statusBadge = <span className="db-badge db-badge--warning">Unverified</span>;
  } else if (!client.mustChangePassword && !client.mustChangePin) {
    statusBadge = <span className="db-badge db-badge--success">✓ Verified</span>;
  } else {
    statusBadge = <span className="db-badge db-badge--info">Partially Verified</span>;
  }

  return (
    <>
      <div className="db-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="db-modal" style={{ width: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div className="db-modal__head">
            <span className="db-modal__title">
              {isEditing ? 'Edit Business' : 'Business Details'}
            </span>
            <button className="db-modal__close" onClick={onClose}>✕</button>
          </div>

          {/* Body */}
          <div className="db-modal__body" style={{ overflowY: 'auto', flex: 1 }}>
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
                  <label className="cl-modal-field__label">Email</label>
                  <input
                    type="text"
                    className="cl-edit-input"
                    value={client.email}
                    disabled
                    style={{ cursor: 'not-allowed', opacity: 0.7 }}
                  />
                </div>
                
                <div className="cl-modal-field">
                  <label className="cl-modal-field__label">New Password</label>
                  <input
                    name="password"
                    type="password"
                    className="cl-edit-input"
                    placeholder="Leave blank to keep current password"
                    value={form.password}
                    onChange={handleChange}
                    maxLength={128}
                  />
                </div>
                
                <div className="cl-modal-field">
                  <label className="cl-modal-field__label">New 6-Digit PIN</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    className="cl-edit-input"
                    placeholder="Leave blank to keep current PIN"
                    value={form.pin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setForm((f) => ({ ...f, pin: val }));
                    }}
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

                <Divider label="Properties" />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {form.properties.map((prop, index) => (
                    <div
                      key={prop._id || index}
                      style={{
                        border: '1px solid var(--color-border, #e5e9ec)',
                        borderRadius: 'var(--radius-md, 10px)',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        background: 'var(--color-surface-2, #f8faf9)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: '.75rem', fontWeight: 600,
                          color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.05em',
                        }}>
                          Property {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeProperty(index)}
                          style={{
                            background: 'none', border: 'none',
                            color: 'var(--color-danger, #b91c1c)', cursor: 'pointer',
                            padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                            fontSize: '.75rem', fontWeight: 500,
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
                          </svg>
                          Remove
                        </button>
                      </div>

                      <div className="db-field" style={{ margin: 0 }}>
                        <label>
                          Property Name
                          <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Sunset Villas"
                          value={prop.name}
                          onChange={setProp(index, 'name')}
                          maxLength={150}
                          className="cl-edit-input"
                        />
                      </div>

                      <div className="db-field" style={{ margin: 0 }}>
                        <label>
                          {prop.hasSmoobuKey ? "Update Smoobu API Key" : "Smoobu API Key"}
                        </label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="Optional"
                            value={prop.smoobuApiKey}
                            onChange={setProp(index, 'smoobuApiKey')}
                            maxLength={512}
                            className="cl-edit-input"
                            disabled={prop.hasSmoobuKey && !prop.isUnmasked}
                            style={{ paddingRight: 40, width: '100%' }}
                          />
                          {prop.hasSmoobuKey && !prop.isUnmasked && (
                            <button
                              type="button"
                              onClick={() => showApiKey(index, prop._id)}
                              style={{
                                position: 'absolute', right: 12, background: 'none', border: 'none',
                                cursor: 'pointer', color: 'var(--color-muted)', display: 'flex', alignItems: 'center'
                              }}
                              title="Show API Key"
                            >
                              <i className="ti ti-eye" style={{ fontSize: 16 }} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add another property */}
                <button
                  type="button"
                  onClick={addProperty}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    padding: '9px 0',
                    border: '1.5px dashed var(--color-border, #c8ddd5)',
                    borderRadius: 'var(--radius-md, 10px)',
                    background: 'transparent',
                    color: 'var(--color-brand, #26a676)',
                    fontSize: '.8125rem', fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'background .15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2, #f0f7f4)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                  </svg>
                  Add Property
                </button>
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
                  <Field label="Status" value={statusBadge} />
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
                    properties={properties}
                    loading={loadingProps}
                    error={propsError}
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

      {otpAction && (
        <OTPModal 
          email={JSON.parse(sessionStorage.getItem('hp_user') || '{}')?.email}
          onVerified={handleOtpVerified} 
          onCancel={() => setOtpAction(null)} 
        />
      )}
    </>
  );
}
