import { useState, useEffect } from 'react';
import { fetchClientProperties, createStaff, updateStaff } from '../services/staffApi';

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1.5px solid #e2e8f0',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#fafafa',
  color: '#1a202c',
  transition: 'border-color 0.15s',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: '#4a5568',
  marginBottom: 5,
  letterSpacing: '0.03em',
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
      } else {
        await createStaff(body);
      }

      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1rem",
              fontWeight: 700,
              color: "#1a202c",
            }}
          >
            {isEdit ? "Edit Staff" : "Create Staff Account"}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#718096",
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "16px 24px 24px" }}>
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, firstName: e.target.value }))
                }
                required
                style={inputStyle}
                placeholder="Juan"
              />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastName: e.target.value }))
                }
                style={inputStyle}
                placeholder="Dela Cruz"
              />
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              required
              disabled={isEdit}
              style={{ ...inputStyle, cursor: isEdit ? "not-allowed" : "text" }}
              placeholder="staff@example.com"
            />
          </div>

          {/* PIN */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              {isEdit
                ? "New 6-Digit PIN (leave blank to keep)"
                : "Temporary 6-Digit PIN *"}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={form.pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setForm((f) => ({ ...f, pin: val }));
              }}
              required={!isEdit}
              style={inputStyle}
              placeholder={
                isEdit ? "Leave blank to keep current" : "Exactly 6 digits"
              }
              autoComplete="new-password"
            />
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <div
              style={{
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <label style={{ ...labelStyle, margin: 0 }}>Active</label>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, isActive: !f.isActive }))
                }
                style={{
                  width: 42,
                  height: 24,
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  background: form.isActive ? "#26a676" : "#cbd5e0",
                  position: "relative",
                  transition: "background 0.2s",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: form.isActive ? 20 : 3,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          )}

          {/* Properties */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Assign Properties</label>
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
                <div
                  style={{
                    border: "1.5px solid #e2e8f0",
                    borderRadius: 8,
                    overflow: "hidden",
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {properties.map((prop) => {
                    const checked = form.propertyIds.includes(String(prop.id));
                    return (
                      <label
                        key={prop.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 14px",
                          cursor: "pointer",
                          background: checked ? "#f0f7ff" : "transparent",
                          borderBottom: "1px solid #f0f0f0",
                          fontSize: "0.875rem",
                          color: "#2d3748",
                          transition: "background 0.1s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProperty(prop.id)}
                          style={{
                            accentColor: "#3b5fc0",
                            width: 15,
                            height: 15,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontWeight: checked ? 600 : 400 }}>
                          {prop.propertyName}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "#888",
                    margin: "4px 0 0",
                    fontStyle: "italic",
                  }}
                >
                  No properties assigned to this client.
                </p>
              ))}
          </div>

          {error && (
            <div
              style={{
                background: "#fff0ee",
                color: "#c13515",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: "0.83rem",
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 20px",
                borderRadius: 8,
                border: "1.5px solid #e2e8f0",
                background: "#fff",
                color: "#4a5568",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "9px 24px",
                borderRadius: 8,
                border: "none",
                background: saving ? "#a0aec0" : "#1555C0",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Staff"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}