import { useState, useEffect } from 'react';
import { fetchClientProperties, createStaff, updateStaff } from '../services/staffApi';
import { toast } from '../../../utils/toast';

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1.5px solid #e8edf2',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#f8fafc',
  color: '#0f172a',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#64748b',
  marginBottom: 6,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

export default function StaffModal({ mode, staff, clients, onClose, onSaved }) {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    clientId:    staff?.clientId?._id || staff?.clientId || '',
    firstName:   staff?.firstName || '',
    lastName:    staff?.lastName  || '',
    email:       staff?.email     || '',
    pin:         '',
    propertyIds: staff?.propertyIds || [],
    isActive:    staff?.isActive !== false,
  });

  const [clientSearch, setClientSearch] = useState(() => {
    if (staff?.clientId) {
      const c = clients.find(
        (x) => x._id === (staff.clientId?._id || staff.clientId)
      );
      return c ? c.businessName : '';
    }
    return '';
  });
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [properties, setProperties]    = useState([]);
  const [propsLoading, setPropsLoading] = useState(false);
  const [propsError, setPropsError]    = useState('');
  const [saving, setSaving]            = useState(false);
  const [error, setError]              = useState('');

  // Load properties when clientId changes
  useEffect(() => {
    if (!form.clientId) {
      setProperties([]);
      return;
    }
    setPropsLoading(true);
    setPropsError('');
    fetchClientProperties(form.clientId)
      .then((data) => {
        setProperties(data.properties || []);
      })
      .catch(() => setPropsError('Failed to load properties.'))
      .finally(() => setPropsLoading(false));
  }, [form.clientId]);

  function toggleProperty(id) {
    const strId = String(id);
    setForm((f) => ({
      ...f,
      propertyIds: f.propertyIds.includes(strId)
        ? f.propertyIds.filter((p) => p !== strId)
        : [...f.propertyIds, strId],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const body = {
        clientId:    form.clientId,
        firstName:   form.firstName,
        lastName:    form.lastName,
        email:       form.email,
        propertyIds: form.propertyIds,
      };
      if (form.pin)      body.pin      = form.pin;
      
      if (isEdit) {
        if (form.isActive !== undefined) body.isActive = form.isActive;
      } else {
        body.pin      = form.pin;
      }

      if (isEdit) {
        await updateStaff(staff._id, body);
        toast.success(`${form.firstName} ${form.lastName} has been updated.`, { title: 'Staff Updated' });
      } else {
        await createStaff(body);
        toast.success(`${form.firstName} ${form.lastName} has been added.`, { title: 'Staff Created' });
      }

      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <style>{`
      @keyframes st-modal-overlay { from { opacity: 0; } to { opacity: 1; } }
      @keyframes st-modal-card { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
    `}</style>
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(12,28,20,0.45)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: 'st-modal-overlay 0.2s ease',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          border: "none",
          display: "flex",
          flexDirection: "column",
          animation: 'st-modal-card 0.28s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '28px 32px 0 32px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{
              fontSize: '1.6rem', fontWeight: 800, color: '#0d1117',
              lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em',
            }}>
              {isEdit ? <>Edit <span style={{ color: '#26a676' }}>Staff</span></> : <>Create <span style={{ color: '#26a676' }}>Staff</span></>}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '.8125rem', color: '#9ca3af', fontWeight: 400 }}>
              {isEdit ? 'Update the staff account details below.' : 'Fill in the details to create a staff account.'}
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

        <form onSubmit={handleSubmit} style={{ padding: '20px 32px 0', overflowY: 'auto', flex: 1 }}>
          {/* Profile row — show selected client info */}
          {form.clientId && (() => {
            const c = clients.find(x => x._id === form.clientId);
            if (!c) return null;
            const parts = c.businessName.trim().split(/\s+/);
            const ini = parts.length === 1 ? (parts[0][0] ?? '').toUpperCase() : `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
            return (
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
                }}>{ini}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0d1117' }}>{c.businessName}</div>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 1 }}>{c.email}</div>
                </div>
              </div>
            );
          })()}
          {/* Client selector — searchable list */}
          <div style={{ marginBottom: 14, position: "relative" }}>
            <label style={labelStyle}>Business *</label>
            {isEdit ? (
              <div
                style={{
                  ...inputStyle,
                  cursor: "not-allowed",
                  color: "#718096",
                  background: "#f0f0f0",
                }}
              >
                {(() => {
                  const c = clients.find((x) => x._id === form.clientId);
                  return c
                    ? `${c.businessName} (${c.email})`
                    : form.clientId || "—";
                })()}
              </div>
            ) : (
              <>
                <div
                  style={{
                    ...inputStyle,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    userSelect: "none",
                    color: form.clientId ? "#1a202c" : "#a0aec0",
                  }}
                  onClick={() => setShowClientDropdown((v) => !v)}
                >
                  <span>
                    {form.clientId
                      ? (() => {
                          const c = clients.find(
                            (x) => x._id === form.clientId,
                          );
                          return c
                            ? `${c.businessName} (${c.email})`
                            : "— Select a client —";
                        })()
                      : "— Select a client —"}
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="M2 4l4 4 4-4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                {showClientDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      zIndex: 200,
                      background: "#fff",
                      border: "1.5px solid #e2e8f0",
                      borderRadius: 8,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                      marginTop: 4,
                      overflow: "hidden",
                    }}
                  >
                    {/* Search box inside dropdown */}
                    <div
                      style={{
                        padding: "8px 10px",
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      <input
                        autoFocus
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Search client…"
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1.5px solid #e2e8f0",
                          fontSize: "0.83rem",
                          outline: "none",
                          boxSizing: "border-box",
                          background: "#fafafa",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {/* Client list */}
                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                      {clients
                        .filter((c) => {
                          const q = clientSearch?.toLowerCase();
                          return (
                            !q ||
                            c.businessName?.toLowerCase().includes(q) ||
                            c.email?.toLowerCase().includes(q)
                          );
                        })
                        .map((c) => (
                          <div
                            key={c._id}
                            onClick={() => {
                              setForm((f) => ({
                                ...f,
                                clientId: c._id,
                                propertyIds: [],
                              }));
                              setClientSearch(c.businessName);
                              setShowClientDropdown(false);
                            }}
                            style={{
                              padding: "9px 14px",
                              cursor: "pointer",
                              fontSize: "0.875rem",
                              background:
                                form.clientId === c._id
                                  ? "#eef4ff"
                                  : "transparent",
                              color: "#2d3748",
                              borderBottom: "1px solid #f7f7f7",
                              transition: "background 0.1s",
                            }}
                            onMouseEnter={(e) => {
                              if (form.clientId !== c._id)
                                e.currentTarget.style.background = "#f7f9ff";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background =
                                form.clientId === c._id
                                  ? "#eef4ff"
                                  : "transparent";
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>
                              {c.businessName}
                            </div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#718096",
                                marginTop: 1,
                              }}
                            >
                              {c.email}
                            </div>
                          </div>
                        ))}
                      {clients.filter((c) => {
                        const q = clientSearch?.toLowerCase();
                        return (
                          !q ||
                          c.businessName?.toLowerCase().includes(q) ||
                          c.email?.toLowerCase().includes(q)
                        );
                      }).length === 0 && (
                        <div
                          style={{
                            padding: "12px 14px",
                            fontSize: "0.83rem",
                            color: "#a0aec0",
                            textAlign: "center",
                          }}
                        >
                          No clients found
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Hidden required input for validation */}
                <input
                  tabIndex={-1}
                  required
                  value={form.clientId}
                  onChange={() => {}}
                  style={{
                    opacity: 0,
                    height: 0,
                    position: "absolute",
                    pointerEvents: "none",
                  }}
                />
              </>
            )}
          </div>

          {/* Name row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <label style={labelStyle}>First Name *</label>
              <input
                value={form.firstName}
                onChange={(e) => { const val = e.target.value; if (/^[a-zA-Z\s.'-]*$/.test(val)) setForm((f) => ({ ...f, firstName: val })); }}
                required
                style={{ ...inputStyle, ...(form.firstName && /[^a-zA-Z\s.'-]/.test(form.firstName) ? { borderColor: '#ef4444' } : {}) }}
                placeholder="Juan"
              />
              {form.firstName && /[^a-zA-Z\s.'-]/.test(form.firstName) && (
                <span style={{ color: '#ef4444', fontSize: '.72rem', fontWeight: 600, marginTop: 3, display: 'block' }}>⚠ Letters only.</span>
              )}
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) => { const val = e.target.value; if (/^[a-zA-Z\s.'-]*$/.test(val)) setForm((f) => ({ ...f, lastName: val })); }}
                style={{ ...inputStyle, ...(form.lastName && /[^a-zA-Z\s.'-]/.test(form.lastName) ? { borderColor: '#ef4444' } : {}) }}
                placeholder="Dela Cruz"
              />
              {form.lastName && /[^a-zA-Z\s.'-]/.test(form.lastName) && (
                <span style={{ color: '#ef4444', fontSize: '.72rem', fontWeight: 600, marginTop: 3, display: 'block' }}>⚠ Letters only.</span>
              )}
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              disabled={isEdit}
              style={{ ...inputStyle, cursor: isEdit ? 'not-allowed' : 'text', ...(!isEdit && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? { borderColor: '#ef4444' } : {}) }}
              placeholder="staff@example.com"
            />
            {!isEdit && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && (
              <span style={{ color: '#ef4444', fontSize: '.72rem', fontWeight: 600, marginTop: 3, display: 'block' }}>⚠ Enter a valid email (e.g. staff@example.com).</span>
            )}
          </div>

          {/* PIN */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              {isEdit ? "New 6-Digit PIN (leave blank to keep)" : "Temporary 6-Digit PIN *"}
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, width: '100%' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  id={`pin-box-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={form.pin[i] || ''}
                  required={!isEdit && i === 0 && !form.pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const pins = form.pin.split('');
                    pins[i] = val;
                    const newPin = pins.join('').slice(0, 6);
                    setForm((f) => ({ ...f, pin: newPin }));
                    if (val && i < 5) {
                      document.getElementById(`pin-box-${i + 1}`)?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !form.pin[i] && i > 0) {
                      document.getElementById(`pin-box-${i - 1}`)?.focus();
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                    setForm((f) => ({ ...f, pin: pasted }));
                    const nextBox = Math.min(pasted.length, 5);
                    document.getElementById(`pin-box-${nextBox}`)?.focus();
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 52,
                    textAlign: 'center',
                    fontSize: '1.2rem', fontWeight: 700,
                    borderRadius: 10,
                    border: `1.5px solid ${form.pin[i] ? '#3b5fc0' : '#ececec'}`,
                    background: form.pin[i] ? '#f0f4ff' : '#f7f8fa',
                    outline: 'none',
                    color: '#1a202c',
                    transition: 'border-color 0.15s, background 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b5fc0'}
                  onBlur={(e) => e.target.style.borderColor = form.pin[i] ? '#3b5fc0' : '#ececec'}
                  autoComplete="new-password"
                />
              ))}
            </div>
          </div>
          {form.pin && form.pin.length > 0 && form.pin.length < 6 && (
            <span style={{ color: '#ef4444', fontSize: '.72rem', fontWeight: 600, marginTop: 6, display: 'block' }}>⚠ PIN must be exactly 6 digits ({form.pin.length}/6).</span>
          )}
          {form.pin && form.pin.length === 6 && (
            <span style={{ color: '#26a676', fontSize: '.72rem', fontWeight: 600, marginTop: 6, display: 'block' }}>✓ PIN is valid.</span>
          )}

          {/* Properties */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <label style={labelStyle}>Assign Properties</label>
              {isEdit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...labelStyle, margin: 0 }}>Active</span>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                    style={{
                      width: 42, height: 24, borderRadius: 999, border: 'none',
                      cursor: 'pointer',
                      background: form.isActive ? '#26a676' : '#cbd5e0',
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3,
                      left: form.isActive ? 20 : 3,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>
              )}
            </div>
            {!form.clientId && (
              <p
                style={{ fontSize: "0.8rem", color: "#aaa", margin: "4px 0 0" }}
              >
                Select a client first to load their properties.
              </p>
            )}
            {propsLoading && (
              <p
                style={{ fontSize: "0.8rem", color: "#888", margin: "4px 0 0" }}
              >
                Loading properties…
              </p>
            )}
            {propsError && (
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "#c13515",
                  margin: "4px 0 0",
                }}
              >
                {propsError}
              </p>
            )}
            {!propsLoading &&
              !propsError &&
              form.clientId &&
              (properties.length > 0 ? (
                <div style={{
                  border: '1.5px solid #e8edf2',
                  borderRadius: 12,
                  overflow: 'hidden',
                  maxHeight: 240,
                  overflowY: 'auto',
                }}>
                  {properties.map((prop, idx) => {
                    const checked = form.propertyIds.includes(String(prop.id));
                    const words = (prop.propertyName || '').trim().split(/\s+/);
                    const ini = words.length === 1
                      ? (words[0][0] ?? '').toUpperCase()
                      : `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
                    return (
                      <div
                        key={prop.id}
                        onClick={() => toggleProperty(prop.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '11px 14px',
                          cursor: 'pointer',
                          background: checked ? '#f0fdf4' : '#fff',
                          borderBottom: idx < properties.length - 1 ? '1px solid #f0f2f5' : 'none',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => { if (!checked) e.currentTarget.style.background = '#f8faf9'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = checked ? '#f0fdf4' : '#fff'; }}
                      >
                        {/* Avatar */}
                        <div style={{
                          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                          background: checked
                            ? 'linear-gradient(135deg, #26a676, #1d8a62)'
                            : 'linear-gradient(135deg, #e5e9ec, #d1d5db)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 700, fontSize: '0.78rem',
                          transition: 'background 0.12s',
                        }}>
                          {ini || '?'}
                        </div>

                        {/* Name */}
                        <span style={{
                          flex: 1,
                          fontSize: '0.875rem',
                          fontWeight: checked ? 600 : 400,
                          color: checked ? '#0d1117' : '#4a5568',
                          transition: 'color 0.12s',
                        }}>
                          {prop.propertyName}
                        </span>

                        {/* Checkmark */}
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          border: checked ? 'none' : '1.5px solid #d1d5db',
                          background: checked ? '#26a676' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.12s',
                        }}>
                          {checked && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="2,6 5,9 10,3" />
                            </svg>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{
                  fontSize: '0.8rem', color: '#888',
                  margin: '4px 0 0', fontStyle: 'italic',
                }}>
                  No properties assigned to this client.
                </p>
              ))}
          </div>

          {error && (
            <div style={{
              background: '#fee2e2', color: '#b91c1c',
              borderRadius: 8, padding: '10px 14px',
              fontSize: '.8125rem', fontWeight: 500, marginBottom: 14,
            }}>
              ⚠️ {error}
            </div>
          )}

          </form>

        {/* Footer */}
        <div style={{
          padding: '16px 32px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 10,
          borderTop: '1px solid #f0f2f5',
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={onClose}
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
            type="button"
            onClick={(e) => { e.preventDefault(); document.querySelector('form')?.requestSubmit?.() || handleSubmit(e); }}
            disabled={saving}
            style={{
              padding: '9px 26px', borderRadius: 10,
              border: 'none', background: saving ? '#9ca3af' : '#0d1117',
              fontSize: '0.875rem', fontWeight: 700, color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 2px 8px rgba(13,17,23,0.18)',
            }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Staff'}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}