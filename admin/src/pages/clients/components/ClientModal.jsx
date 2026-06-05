import { useState, useEffect, useCallback } from 'react';
import { updateClient, getClientSmoobuData, createClientProperty, updateClientProperty, deleteClientProperty, getClientPropertyApiKey, uploadPropertyPicture } from '../services/clientsService';
import ClientSmoobuView from './ClientSmoobuView';
import ImageCropModal from './ImageCropModal';
import OTPModal from '../../../components/OTPModal';
import ConfirmModal from './ConfirmModal';
import { sendLoginOtp } from '../../authorization/services/authService';

function mapPropertiesForEdit(properties = []) {
  return properties.map((p) => ({
    _id: p._id,
    name: p.propertyName || p.name || '',
    hasSmoobuKey: !!p.hasSmoobuKey,
    maskedSmoobuApiKey: p.maskedSmoobuApiKey || '',
    smoobuApiKey: p.maskedSmoobuApiKey || '',
    isUnmasked: false,
    propertyPicture: p.propertyPicture || '',
    originalPictureUrl: p.propertyPictureOriginal || '',
    cropData: p.propertyPictureCropData || null,
    pictureFile: null,
    cropDirty: false,
    pictureUrl: p.propertyPicture || '',
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
  const [croppingIndex,    setCroppingIndex]    = useState(null);
  const [cropImageUrl,     setCropImageUrl]     = useState(null);
  const [initialCropData,  setInitialCropData]  = useState(null);

  // ── Confirmation modal state ──────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState(null);
  // confirmDialog shape: { title, message, confirmLabel, confirmVariant, onConfirm }

  const [properties, setProperties] = useState([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [propsError, setPropsError] = useState(null);

  const [activeTab, setActiveTab] = useState('details');
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

  // ── Replaces window.confirm for remove property ───────────────────
  const removeProperty = (index) => {
    setConfirmDialog({
      title: 'Remove Property',
      message: 'Are you sure you want to remove this property? This action cannot be undone.',
      confirmLabel: 'Remove',
      confirmVariant: 'danger',
      onConfirm: () => {
        setConfirmDialog(null);
        setOtpAction({ type: 'remove-prop', index });
        sendLoginOtp().catch(err => alert(err.message));
      },
    });
  };

  // ── Replaces window.confirm for show API key ──────────────────────
  const showApiKey = (index, propertyId) => {
    setConfirmDialog({
      title: 'Show API Key',
      message: 'Proceed in showing the API key? You will need to verify via OTP.',
      confirmLabel: 'Proceed',
      confirmVariant: 'primary',
      onConfirm: () => {
        setConfirmDialog(null);
        setOtpAction({ type: 'show-key', index, propertyId });
        sendLoginOtp().catch(err => alert(err.message));
      },
    });
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
        let propId = p._id;
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
          const createdProp = await createClientProperty(client._id, {
            propertyName: p.name.trim(),
            smoobuApiKey: p.smoobuApiKey.trim() || ''
          });
          propId = createdProp._id;
        }

        // 3. Handle picture upload or crop update (only if user actually changed something)
        if (p.pictureFile || p.cropDirty) {
          try {
            await uploadPropertyPicture(client._id, propId, p.pictureFile, p.cropData);
          } catch (picErr) {
            console.error('Failed to update picture for property:', p.name, picErr);
          }
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
        <div className="db-modal" style={{ width: '95vw', maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 20, padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            padding: '28px 32px 0 32px',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          }}>
            <div>
              <h2 style={{
                fontSize: '1.6rem', fontWeight: 800, color: '#0d1117',
                lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em',
              }}>
                Business <span style={{ color: '#26a676' }}>Details</span>
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: '.8125rem', color: '#9ca3af', fontWeight: 400 }}>
                Please review the business details below.
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: '#f3f4f6', border: 'none', borderRadius: 10,
                width: 32, height: 32, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: '#6b7280',
                fontSize: '1rem', flexShrink: 0, marginTop: 2,
              }}
            >✕</button>
          </div>

          {/* Body */}
          <div className="db-modal__body" style={{ overflowY: 'auto', flex: 1, padding: '20px 32px 8px' }}>
            {/* Profile row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderRadius: 12,
              background: '#f8faf9', border: '1px solid #e5efe9',
              marginBottom: 16,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'linear-gradient(135deg, #26a676, #1d8a62)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: '0.95rem', flexShrink: 0,
              }}>
                {initials(client.businessName)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0d1117' }}>
                  {client.businessName}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 1 }}>{client.email}</div>
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

            {false ? (
              /* ── Edit form ── */
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }} className="cl-modal-edit-form">
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

                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Properties</div>
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

                      <div className="db-field" style={{ margin: 0 }}>
                        <label>Property Picture</label>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          id={`edit-picture-input-${index}`}
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              const file = e.target.files[0];
                              const url = URL.createObjectURL(file);
                              setForm((prev) => ({
                                ...prev,
                                properties: prev.properties.map((p, i) =>
                                  i === index ? { ...p, pictureFile: file, originalPictureUrl: url, cropDirty: true } : p
                                ),
                              }));
                              setCropImageUrl(url);
                              setInitialCropData(null);
                              setCroppingIndex(index);
                            }
                            e.target.value = null;
                          }}
                        />
                        <label
                          htmlFor={`edit-picture-input-${index}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            aspectRatio: '1',
                            borderRadius: '12px',
                            border: prop.pictureUrl ? 'none' : '2px dashed lightgray',
                            background: prop.pictureUrl
                              ? 'transparent'
                              : 'linear-gradient(135deg, rgba(198, 221, 213, 0.3) 0%, rgba(38, 166, 118, 0.05) 100%)',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                          }}
                          onMouseEnter={(e) => {
                            if (!prop.pictureUrl) {
                              e.currentTarget.style.borderColor = 'var(--color-brand, #26a676)';
                              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(198, 221, 213, 0.5) 0%, rgba(38, 166, 118, 0.12) 100%)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!prop.pictureUrl) {
                              e.currentTarget.style.borderColor = 'lightgray';
                              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(198, 221, 213, 0.3) 0%, rgba(38, 166, 118, 0.05) 100%)';
                            }
                          }}
                        >
                          {prop.pictureUrl ? (
                            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                              <img
                                src={prop.pictureUrl}
                                crossOrigin="anonymous"
                                alt="Property preview"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '8px',
                                  right: '8px',
                                  background: 'rgba(255, 255, 255, 0.7)',
                                  backdropFilter: 'blur(8px)',
                                  border: '1px solid rgba(255, 255, 255, 0.3)',
                                  borderRadius: '10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-end',
                                  gap: '6px',
                                  padding: '6px 6px',
                                }}
                              >
                                {/* Change button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    document.getElementById(`edit-picture-input-${index}`).click();
                                  }}
                                  style={{
                                    background: 'white', border: 'none', borderRadius: '6px',
                                    padding: '6px 6px', color: 'var(--color-brand, #26a676)', cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '0px', minWidth: '32px', height: '32px',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.minWidth = '80px';
                                    e.currentTarget.style.gap = '6px';
                                    e.currentTarget.style.paddingLeft = '8px';
                                    e.currentTarget.style.paddingRight = '8px';
                                    const label = e.currentTarget.querySelector('[data-label-change]');
                                    if (label) { label.style.maxWidth = '60px'; label.style.opacity = '1'; }
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.minWidth = '32px';
                                    e.currentTarget.style.gap = '0px';
                                    e.currentTarget.style.paddingLeft = '6px';
                                    e.currentTarget.style.paddingRight = '6px';
                                    const label = e.currentTarget.querySelector('[data-label-change]');
                                    if (label) { label.style.maxWidth = '0px'; label.style.opacity = '0'; }
                                  }}
                                  title="Change picture"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                  </svg>
                                  <span
                                    data-label-change=""
                                    style={{
                                      maxWidth: '0px', overflow: 'hidden', whiteSpace: 'nowrap',
                                      fontSize: '.65rem', fontWeight: 600, opacity: 0,
                                      transition: 'max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }}
                                  >
                                    Change
                                  </span>
                                </button>

                                {/* Adjust button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setCropImageUrl(prop.originalPictureUrl || prop.pictureUrl);
                                    setInitialCropData(prop.cropData);
                                    setCroppingIndex(index);
                                  }}
                                  style={{
                                    background: 'white', border: 'none', borderRadius: '6px',
                                    padding: '6px 6px', color: 'var(--color-brand, #26a676)', cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '0px', minWidth: '32px', height: '32px',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.minWidth = '80px';
                                    e.currentTarget.style.gap = '6px';
                                    e.currentTarget.style.paddingLeft = '8px';
                                    e.currentTarget.style.paddingRight = '8px';
                                    const label = e.currentTarget.querySelector('[data-label-adjust]');
                                    if (label) { label.style.maxWidth = '60px'; label.style.opacity = '1'; }
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.minWidth = '32px';
                                    e.currentTarget.style.gap = '0px';
                                    e.currentTarget.style.paddingLeft = '6px';
                                    e.currentTarget.style.paddingRight = '6px';
                                    const label = e.currentTarget.querySelector('[data-label-adjust]');
                                    if (label) { label.style.maxWidth = '0px'; label.style.opacity = '0'; }
                                  }}
                                  title="Adjust picture"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <line x1="4" y1="6" x2="20" y2="6" />
                                    <line x1="4" y1="12" x2="20" y2="12" />
                                    <line x1="4" y1="18" x2="20" y2="18" />
                                    <circle cx="14" cy="6" r="2" fill="currentColor" stroke="none" />
                                    <circle cx="8" cy="12" r="2" fill="currentColor" stroke="none" />
                                    <circle cx="14" cy="18" r="2" fill="currentColor" stroke="none" />
                                  </svg>
                                  <span
                                    data-label-adjust=""
                                    style={{
                                      maxWidth: '0px', overflow: 'hidden', whiteSpace: 'nowrap',
                                      fontSize: '.65rem', fontWeight: 600, opacity: 0,
                                      transition: 'max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }}
                                  >
                                    Adjust
                                  </span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 }}>
                              <div style={{
                                width: 48, height: 48, borderRadius: '10px',
                                background: 'var(--color-brand, #26a676)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', boxShadow: '0 2px 8px rgba(38, 166, 118, 0.2)',
                              }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                  <circle cx="8.5" cy="8.5" r="1.5" />
                                  <polyline points="21 15 16 10 5 21" />
                                </svg>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '.8125rem', fontWeight: 600, color: 'var(--color-brand, #26a676)', marginBottom: 2 }}>
                                  Upload Picture
                                </div>
                                <div style={{ fontSize: '.7rem', color: 'var(--color-muted, #666)', lineHeight: 1.3 }}>
                                  Click to upload or drag and drop
                                </div>
                              </div>
                            </div>
                          )}
                        </label>
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
          <div style={{
            padding: '16px 32px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: 10,
            borderTop: '1px solid #f0f2f5',
            marginTop: 4,
          }}>
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  style={{
                    padding: '9px 22px', borderRadius: 10,
                    border: '1.5px solid #e5e7eb', background: '#fff',
                    fontSize: '0.875rem', fontWeight: 600, color: '#374151',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '9px 26px', borderRadius: 10,
                    border: 'none', background: saving ? '#9ca3af' : '#0d1117',
                    fontSize: '0.875rem', fontWeight: 700, color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: saving ? 'none' : '0 2px 8px rgba(13,17,23,0.18)',
                  }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  style={{
                    padding: '9px 22px', borderRadius: 10,
                    border: '1.5px solid #e5e7eb', background: '#fff',
                    fontSize: '0.875rem', fontWeight: 600, color: '#374151',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                <button
                  onClick={handleEditToggle}
                  style={{
                    padding: '9px 26px', borderRadius: 10,
                    border: 'none', background: '#0d1117',
                    fontSize: '0.875rem', fontWeight: 700, color: '#fff',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(13,17,23,0.18)',
                  }}
                >
                  Edit
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit modal — separate modal on top of ClientModal ── */}
      {isEditing && (
        <div className="db-modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsEditing(false)}>
          <div className="db-modal" style={{ width: '95vw', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 20, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '28px 32px 0 32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0d1117', lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em' }}>
                  Edit <span style={{ color: '#26a676' }}>Business</span>
                </h2>
                <p style={{ margin: '6px 0 0', fontSize: '.8125rem', color: '#9ca3af', fontWeight: 400 }}>
                  Update the business information below.
                </p>
              </div>
              <button onClick={() => { setSaveError(null); setIsEditing(false); }} style={{ background: '#f3f4f6', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280', fontSize: '1rem', flexShrink: 0, marginTop: 2 }}>✕</button>
            </div>
            <div className="db-modal__body" style={{ overflowY: 'auto', flex: 1, padding: '20px 32px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: '#f8faf9', border: '1px solid #e5efe9', marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #26a676, #1d8a62)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.95rem', flexShrink: 0 }}>{initials(client.businessName)}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0d1117' }}>{client.businessName}</div>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 1 }}>{client.email}</div>
                </div>
              </div>
              {saveError && (
                <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '.8125rem', fontWeight: 500, marginBottom: 12 }}>⚠️ {saveError}</div>
              )}
              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '2px solid #e5e9ec', marginBottom: 20 }}>
                <button type="button" onClick={() => setActiveTab('details')} style={{ padding: '8px 20px', fontSize: '.85rem', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: activeTab === 'details' ? '#26a676' : '#9ca3af', borderBottom: activeTab === 'details' ? '2px solid #26a676' : '2px solid transparent', marginBottom: -2 }}>Details</button>
                <button type="button" onClick={() => setActiveTab('properties')} style={{ padding: '8px 20px', fontSize: '.85rem', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: activeTab === 'properties' ? '#26a676' : '#9ca3af', borderBottom: activeTab === 'properties' ? '2px solid #26a676' : '2px solid transparent', marginBottom: -2 }}>Properties</button>
              </div>
              <div style={{ display: activeTab === 'details' ? 'block' : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }} className="cl-modal-edit-form">
                <div className="cl-modal-field">
                  <label className="cl-modal-field__label" htmlFor="edit-businessName">Business Name</label>
                  <input id="edit-businessName" name="businessName" type="text" className="cl-edit-input" placeholder="e.g. Acme Properties Inc." value={form.businessName} onChange={handleChange} maxLength={150} />
                </div>
                <div className="cl-modal-field">
                  <label className="cl-modal-field__label">Email</label>
                  <input type="text" className="cl-edit-input" value={client.email} disabled style={{ cursor: 'not-allowed', opacity: 0.7 }} />
                </div>
                <div className="cl-modal-field">
                  <label className="cl-modal-field__label">New Password</label>
                  <input name="password" type="password" className="cl-edit-input" placeholder="Leave blank to keep current password" value={form.password} onChange={handleChange} maxLength={128} />
                </div>
                <div className="cl-modal-field">
                  <label className="cl-modal-field__label">New 6-Digit PIN</label>
                  <input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} className="cl-edit-input" placeholder="Leave blank to keep current PIN" value={form.pin} onChange={(e) => { const val = e.target.value.replace(/\D/g, '').slice(0, 6); setForm((f) => ({ ...f, pin: val })); }} />
                </div>
                <div className="cl-modal-field">
                  <label className="cl-modal-field__label" htmlFor="edit-role">Role</label>
                  <select id="edit-role" name="role" className="cl-edit-select" value={form.role} onChange={handleChange}>
                    <option value="client">Client</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                </div>
              </div>
              <div style={{ display: activeTab === 'properties' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Properties</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {form.properties.map((prop, index) => (
                    <div key={prop._id || index} style={{ border: '1px solid var(--color-border, #e5e9ec)', borderRadius: 'var(--radius-md, 10px)', padding: '10px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--color-surface-2, #f8faf9)', cursor: 'pointer' }}>
                      {/* Picture */}
                      <input type="file" accept="image/*" style={{ display: 'none' }} id={`edit-picture-input-${index}`} onChange={(e) => { if (e.target.files && e.target.files.length > 0) { const file = e.target.files[0]; const url = URL.createObjectURL(file); setForm((prev) => ({ ...prev, properties: prev.properties.map((p, i) => i === index ? { ...p, pictureFile: file, originalPictureUrl: url, cropDirty: true } : p) })); setCropImageUrl(url); setInitialCropData(null); setCroppingIndex(index); } e.target.value = null; }} />
                      <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden', background: prop.pictureUrl ? 'transparent' : 'linear-gradient(135deg, rgba(198,221,213,0.3), rgba(38,166,118,0.05))', border: prop.pictureUrl ? 'none' : '2px dashed #c8ddd5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
                        onClick={() => document.getElementById(`edit-picture-input-${index}`).click()}>
                        {prop.pictureUrl ? (
                          <img src={prop.pictureUrl} crossOrigin="anonymous" alt={prop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#26a676', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                            </div>
                            <span style={{ fontSize: '.65rem', color: '#26a676', fontWeight: 600 }}>Upload</span>
                          </div>
                        )}
                      </div>
                      {/* Name input */}
                      <input type="text" placeholder="Property name *" value={prop.name} onChange={setProp(index, 'name')} maxLength={150} className="cl-edit-input" style={{ fontSize: '.8rem', textAlign: 'center' }} />
                      {/* Actions row */}
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        {prop.pictureUrl && (
                          <button type="button" onClick={() => { setCropImageUrl(prop.originalPictureUrl || prop.pictureUrl); setInitialCropData(prop.cropData); setCroppingIndex(index); }} style={{ flex: 1, fontSize: '.7rem', padding: '4px 0', border: '1px solid #e5e9ec', borderRadius: 6, background: 'white', color: '#26a676', cursor: 'pointer', fontWeight: 600 }}>Adjust</button>
                        )}
                        <button type="button" onClick={() => removeProperty(index)} style={{ flex: 1, fontSize: '.7rem', padding: '4px 0', border: '1px solid #fecaca', borderRadius: 6, background: 'white', color: '#b91c1c', cursor: 'pointer', fontWeight: 600 }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addProperty} style={{ width: '100%', marginTop: 4, padding: '9px 0', border: '1.5px dashed var(--color-border, #c8ddd5)', borderRadius: 'var(--radius-md, 10px)', background: 'transparent', color: 'var(--color-brand, #26a676)', fontSize: '.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background .15s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2, #f0f7f4)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 4v12M4 10h12" strokeLinecap="round" /></svg>
                  Add Property
                </button>
                </div>
            </div>
            <div style={{ padding: '16px 32px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #f0f2f5', marginTop: 4 }}>
              <button onClick={() => { setSaveError(null); setIsEditing(false); }} disabled={saving} style={{ padding: '9px 22px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: '0.875rem', fontWeight: 600, color: '#374151', cursor: saving ? 'not-allowed' : 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '9px 26px', borderRadius: 10, border: 'none', background: saving ? '#9ca3af' : '#0d1117', fontSize: '0.875rem', fontWeight: 700, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 2px 8px rgba(13,17,23,0.18)' }}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

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

      {/* ── Confirm dialog — replaces window.confirm() ── */}
      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          confirmVariant={confirmDialog.confirmVariant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {croppingIndex !== null && cropImageUrl && (
        <ImageCropModal
          imageUrl={cropImageUrl}
          initialCropData={initialCropData}
          onClose={() => {
            setCroppingIndex(null);
            setCropImageUrl(null);
            setInitialCropData(null);
          }}
          onSave={(cropData, previewBlob) => {
            const url = URL.createObjectURL(previewBlob);
            setForm((prev) => ({
              ...prev,
              properties: prev.properties.map((p, i) => (i === croppingIndex ? { ...p, cropData, cropDirty: true, pictureUrl: url } : p))
            }));
            setCroppingIndex(null);
            setCropImageUrl(null);
            setInitialCropData(null);
          }}
        />
      )}
    </>
  );
}