import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../AuthContext";
import { updateProfile } from "../../apiService";

export default function AccountSettingsModal({ isOpen, onClose }) {
  const { getUser, setUser } = useAuth();
  const auth = useAuth();
  const user = getUser();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    propertyTagPrefix: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
  const [errorMsg, setErrorMsg] = useState("");
  const overlayRef = useRef(null);

  // Sync form with current user data whenever modal opens
  useEffect(() => {
    if (isOpen && user) {
      setForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        propertyTagPrefix: user.propertyTagPrefix || "",
      });
      setSaveStatus(null);
      setErrorMsg("");
    }
  }, [isOpen, user]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (saveStatus) setSaveStatus(null);
  }

  async function handleSave() {
    if (!form.firstName.trim()) {
      setErrorMsg("First name is required.");
      setSaveStatus("error");
      return;
    }

    setSaving(true);
    setSaveStatus(null);
    setErrorMsg("");

    try {
      const res = await updateProfile(form, auth);
      if (!res || !res.ok) {
        const body = res ? await res.json().catch(() => ({})) : {};
        setErrorMsg(body.error || "Failed to update profile. Please try again.");
        setSaveStatus("error");
        return;
      }
      const data = await res.json();
      // Persist updated user to session storage
      if (data.user) {
        setUser(data.user);
      } else {
        // Merge local changes into stored user
        setUser({ ...user, ...form });
      }
      setSaveStatus("success");
    } catch {
      setErrorMsg("An unexpected error occurred. Please try again.");
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const styles = {
    overlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(12, 28, 20, 0.45)",
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
      zIndex: 10000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    },
    modal: {
      background: "#fff",
      borderRadius: "20px",
      width: "100%",
      maxWidth: "480px",
      boxShadow: "0 24px 64px rgba(12,28,20,0.18), 0 4px 16px rgba(12,28,20,0.08)",
      overflow: "hidden",
      position: "relative",
      animation: "modalSlideIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
    },
    header: {
      padding: "24px 28px 20px",
      borderBottom: "1px solid #eaf3ee",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    headerLeft: {
      display: "flex",
      alignItems: "center",
      gap: 14,
    },
    avatarLarge: {
      width: 48,
      height: 48,
      borderRadius: "50%",
      background: "#0c1c14",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18,
      fontWeight: 600,
      color: "#eaf5f0",
      flexShrink: 0,
      letterSpacing: "-0.5px",
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontFamily: "'Sora', sans-serif",
      fontSize: "1.1rem",
      fontWeight: 800,
      color: "#0c1c14",
      margin: 0,
      lineHeight: 1.2,
    },
    subtitle: {
      fontSize: "12px",
      color: "#9ab8a9",
      margin: "4px 0 0",
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      border: "1px solid #e0ede6",
      background: "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: "#6a8b7c",
      fontSize: 14,
      flexShrink: 0,
      transition: "background 0.15s, color 0.15s",
    },
    body: {
      padding: "24px 28px",
    },
    section: {
      marginBottom: 20,
    },
    sectionLabel: {
      fontSize: "10px",
      fontWeight: 700,
      letterSpacing: "0.08em",
      color: "#9ab8a9",
      textTransform: "uppercase",
      marginBottom: 12,
    },
    readOnlyRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 14px",
      background: "#f7faf8",
      borderRadius: 10,
      border: "1px solid #eaf3ee",
      marginBottom: 8,
    },
    readOnlyIcon: {
      fontSize: 14,
      color: "#9ab8a9",
      width: 18,
      textAlign: "center",
      flexShrink: 0,
    },
    readOnlyContent: {
      flex: 1,
      minWidth: 0,
    },
    readOnlyKey: {
      fontSize: "10px",
      color: "#9ab8a9",
      fontWeight: 600,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      marginBottom: 1,
    },
    readOnlyVal: {
      fontSize: "13px",
      color: "#0c1c14",
      fontWeight: 500,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "2px 8px",
      borderRadius: 20,
      fontSize: "11px",
      fontWeight: 600,
    },
    fieldGroup: {
      marginBottom: 14,
    },
    label: {
      display: "block",
      fontSize: "12px",
      fontWeight: 600,
      color: "#4a6b5a",
      marginBottom: 6,
    },
    input: {
      width: "100%",
      padding: "10px 14px",
      borderRadius: 10,
      border: "1.5px solid #d4e8dd",
      fontSize: "13px",
      color: "#0c1c14",
      background: "#fff",
      outline: "none",
      transition: "border-color 0.15s, box-shadow 0.15s",
      boxSizing: "border-box",
      fontFamily: "inherit",
    },
    inputFocus: {
      borderColor: "#1e8760",
      boxShadow: "0 0 0 3px rgba(30,135,96,0.1)",
    },
    row2: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
    },
    footer: {
      padding: "16px 28px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderTop: "1px solid #eaf3ee",
    },
    statusMsg: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: "12px",
      fontWeight: 500,
      flex: 1,
    },
    btnGroup: {
      display: "flex",
      gap: 8,
    },
    cancelBtn: {
      padding: "9px 18px",
      borderRadius: 10,
      border: "1.5px solid #d4e8dd",
      background: "transparent",
      fontSize: "13px",
      fontWeight: 600,
      color: "#4a6b5a",
      cursor: "pointer",
      transition: "background 0.15s",
    },
    saveBtn: {
      padding: "9px 22px",
      borderRadius: 10,
      border: "none",
      background: saving ? "#9ab8a9" : "#0c1c14",
      fontSize: "13px",
      fontWeight: 700,
      color: "#eaf5f0",
      cursor: saving ? "not-allowed" : "pointer",
      display: "flex",
      alignItems: "center",
      gap: 7,
      transition: "background 0.15s",
    },
  };

  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((n) => n.charAt(0).toUpperCase())
    .join("") || "U";

  const formattedLastLogin = user?.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString("en-PH", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
      })
    : "—";

  return (
    <>
      <style>{`
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .acc-input:focus {
          border-color: #1e8760!important;
          box-shadow: 0 0 0 3px rgba(30,135,96,0.10)!important;
        }
        .acc-close-btn:hover { background: #f0f8f4!important; color: #0c1c14!important; }
        .acc-cancel-btn:hover { background: #f0f8f4!important; }
        .acc-save-btn:hover:not(:disabled) { background: #1a3325!important; }
      `}</style>

      <div style={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
        <div style={styles.modal} role="dialog" aria-modal="true" aria-label="Account Settings">
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <div style={styles.avatarLarge}>{initials}</div>
              <div style={styles.headerText}>
                <h2 style={styles.title}>Account Settings</h2>
                <p style={styles.subtitle}>Update your profile information</p>
              </div>
            </div>
            <button
              style={styles.closeBtn}
              className="acc-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div style={styles.body}>
            {/* Read-only info */}
            <div style={styles.section}>
              <p style={styles.sectionLabel}>Account Info</p>

              {/* Email */}
              <div style={styles.readOnlyRow}>
                <i className="ti ti-mail" style={styles.readOnlyIcon} aria-hidden="true" />
                <div style={styles.readOnlyContent}>
                  <p style={styles.readOnlyKey}>Email</p>
                  <p style={styles.readOnlyVal}>{user?.email || "—"}</p>
                </div>
              </div>

              {/* Role & Verified */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={styles.readOnlyRow}>
                  <i className="ti ti-shield-check" style={styles.readOnlyIcon} aria-hidden="true" />
                  <div style={styles.readOnlyContent}>
                    <p style={styles.readOnlyKey}>Role</p>
                    <p style={styles.readOnlyVal} className="capitalize">
                      {user?.role || "client"}
                    </p>
                  </div>
                </div>
                <div style={styles.readOnlyRow}>
                  <i className="ti ti-badge-check" style={styles.readOnlyIcon} aria-hidden="true" />
                  <div style={styles.readOnlyContent}>
                    <p style={styles.readOnlyKey}>Status</p>
                    <span style={{
                      ...styles.badge,
                      background: user?.isVerified ? "#eaf8f1" : "#fff3e0",
                      color: user?.isVerified ? "#1e8760" : "#e07000",
                    }}>
                      {user?.isVerified ? "Verified" : "Unverified"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Last login */}
              <div style={{ ...styles.readOnlyRow, marginTop: 8 }}>
                <i className="ti ti-clock" style={styles.readOnlyIcon} aria-hidden="true" />
                <div style={styles.readOnlyContent}>
                  <p style={styles.readOnlyKey}>Last Login</p>
                  <p style={styles.readOnlyVal}>{formattedLastLogin}</p>
                </div>
              </div>
            </div>

            {/* Editable fields */}
            <div style={styles.section}>
              <p style={styles.sectionLabel}>Edit Profile</p>

              <div style={styles.row2}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="acc-firstName">First Name</label>
                  <input
                    id="acc-firstName"
                    className="acc-input"
                    style={styles.input}
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="First name"
                    maxLength={50}
                    autoComplete="given-name"
                  />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="acc-lastName">Last Name</label>
                  <input
                    id="acc-lastName"
                    className="acc-input"
                    style={styles.input}
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Last name"
                    maxLength={50}
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="acc-prefix">
                  Property Tag Prefix
                  <span style={{ fontWeight: 400, color: "#9ab8a9", marginLeft: 6 }}>
                    (used to filter your Smoobu properties)
                  </span>
                </label>
                <input
                  id="acc-prefix"
                  className="acc-input"
                  style={styles.input}
                  type="text"
                  name="propertyTagPrefix"
                  value={form.propertyTagPrefix}
                  onChange={handleChange}
                  placeholder="e.g. _charmaine"
                  maxLength={100}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            {/* Status message */}
            <div style={styles.statusMsg}>
              {saveStatus === "success" && (
                <>
                  <i className="ti ti-circle-check" style={{ color: "#1e8760", fontSize: 15 }} aria-hidden="true" />
                  <span style={{ color: "#1e8760" }}>Changes saved successfully.</span>
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <i className="ti ti-alert-circle" style={{ color: "#c13515", fontSize: 15 }} aria-hidden="true" />
                  <span style={{ color: "#c13515" }}>{errorMsg}</span>
                </>
              )}
            </div>

            <div style={styles.btnGroup}>
              <button
                style={styles.cancelBtn}
                className="acc-cancel-btn"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                style={styles.saveBtn}
                className="acc-save-btn"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <i className="ti ti-loader-2" style={{ fontSize: 14, animation: "spin 0.8s linear infinite" }} aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  <>
                    <i className="ti ti-check" style={{ fontSize: 14 }} aria-hidden="true" />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
