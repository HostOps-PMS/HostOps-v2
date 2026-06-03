import React, { useState, useEffect, useRef } from "react";
import { sendLoginOtp, verifyOtp } from "../../authorization/services/authService";

const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? "https://hostpilot-smoobu.onrender.com";

// ─────────────────────────────────────────────────────────────────
// changeAdminPassword 
// ─────────────────────────────────────────────────────────────────
async function changeAdminPassword({ currentPassword, newPassword }) {
  const token = sessionStorage.getItem("hp_access_token");
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_API_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to change password. Please try again.");
  return data;
}

import OTPModal from '../../../components/OTPModal';

// ─────────────────────────────────────────────────────────────────
// SuccessModal — shown after password is changed successfully
// ─────────────────────────────────────────────────────────────────
function SuccessModal({ onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(12,28,20,0.6)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 10200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          width: "100%",
          maxWidth: 360,
          boxShadow: "0 24px 64px rgba(12,28,20,0.22)",
          animation: "modalSlideIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          padding: "36px 28px 28px",
          textAlign: "center",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Password Changed Successfully"
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #eaf8f1 0%, #d1f0e3 100%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
            boxShadow: "0 8px 24px rgba(30,135,96,0.18)",
            animation: "successPop 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.1s both",
          }}
        >
          <i className="ti ti-lock-check" style={{ fontSize: 30, color: "#1e8760" }} aria-hidden="true" />
        </div>

        <h3
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: "1.15rem",
            fontWeight: 800,
            color: "#0c1c14",
            margin: "0 0 8px",
          }}
        >
          Password Updated!
        </h3>
        <p style={{ fontSize: 13, color: "#6a8b7c", margin: "0 0 24px", lineHeight: 1.6 }}>
          Your password has been changed successfully.
          <br />Keep it safe and don't share it with anyone.
        </p>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "11px 0",
            borderRadius: 12,
            border: "none",
            background: "#0c1c14",
            color: "#eaf5f0",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontFamily: "inherit",
            transition: "background 0.15s",
          }}
          className="acc-save-btn"
        >
          <i className="ti ti-check" style={{ fontSize: 15 }} aria-hidden="true" />
          Done
        </button>
      </div>
    </div>
  );
}

export default function AccountSettingsModal({ isOpen, onClose }) {
  const getUser = () => {
    try { return JSON.parse(sessionStorage.getItem("hp_user") || "{}"); } catch { return {}; }
  };
  const user = getUser();

  const [activeTab, setActiveTab] = useState("profile");
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwStatus, setPwStatus] = useState(null);
  const [pwErrorMsg, setPwErrorMsg] = useState("");
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const verifiedTokenRef = useRef(null);

  const overlayRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab("profile");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwStatus(null);
      setPwErrorMsg("");
      setShowPw({ current: false, next: false, confirm: false });
      setShowOtpModal(false);
      setShowSuccessModal(false);
      verifiedTokenRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === "Escape" && !showOtpModal && !showSuccessModal) onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, showOtpModal, showSuccessModal]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current && !showOtpModal && !showSuccessModal) onClose();
  }

  function handlePwChange(e) {
    const { name, value } = e.target;
    setPwForm((prev) => ({ ...prev, [name]: value }));
    if (pwStatus) setPwStatus(null);
  }

  async function handleSave() {
    const { currentPassword, newPassword, confirmPassword } = pwForm;

    if (!currentPassword) {
      setPwErrorMsg("Current password is required.");
      setPwStatus("error");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPwErrorMsg("New password must be at least 8 characters.");
      setPwStatus("error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErrorMsg("Passwords do not match.");
      setPwStatus("error");
      return;
    }
    if (newPassword === currentPassword) {
      setPwErrorMsg("New password must be different from your current password.");
      setPwStatus("error");
      return;
    }

    setPwSaving(true);
    setPwStatus(null);
    setPwErrorMsg("");
    try {
      await sendLoginOtp();
      setShowOtpModal(true);
    } catch (err) {
      setPwErrorMsg(err.message);
      setPwStatus("error");
    } finally {
      setPwSaving(false);
    }
  }

  async function handleOtpVerified(otp) {
    verifiedTokenRef.current = otp;
    setShowOtpModal(false);

    const { currentPassword, newPassword } = pwForm;

    try {
      const body = await changeAdminPassword({ currentPassword, newPassword });
      if (body.user) {
        sessionStorage.setItem("hp_user", JSON.stringify(body.user));
      }

      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPw({ current: false, next: false, confirm: false });
      verifiedTokenRef.current = null;

      setShowSuccessModal(true);
    } catch (err) {
      setPwErrorMsg(err.message);
      setPwStatus("error");
    }
  }

  function handleSuccessClose() {
    setShowSuccessModal(false);
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
      maxHeight: "80vh",
      overflowY: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 24px 64px rgba(12,28,20,0.18), 0 4px 16px rgba(12,28,20,0.08)",
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
    row2: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
    },
    pwInputWrap: {
      position: "relative",
      display: "flex",
      alignItems: "center",
    },
    pwInput: {
      width: "100%",
      padding: "10px 40px 10px 14px",
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
    eyeBtn: {
      position: "absolute",
      right: 12,
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#9ab8a9",
      fontSize: 15,
      padding: 0,
      display: "flex",
      alignItems: "center",
      lineHeight: 1,
    },
    divider: {
      height: 1,
      background: "#eaf3ee",
      margin: "4px 0 20px",
    },
    footer: {
      padding: "16px 28px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 10,
      borderTop: "1px solid #eaf3ee",
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
    saveBtn: (isSaving) => ({
      padding: "9px 22px",
      borderRadius: 10,
      border: "none",
      background: isSaving ? "#9ab8a9" : "#0c1c14",
      fontSize: "13px",
      fontWeight: 700,
      color: "#eaf5f0",
      cursor: isSaving ? "not-allowed" : "pointer",
      display: "flex",
      alignItems: "center",
      gap: 7,
      transition: "background 0.15s",
      fontFamily: "inherit",
    }),
  };

  const initials = [user?.firstName, user?.lastName].filter(Boolean).map((n) => n.charAt(0).toUpperCase()).join("") || "U";

  const formattedLastLogin = user?.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString("en-PH", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
      })
    : "—";

  return (
    <>
      <style>{`
        @keyframes modalSlideIn { from { opacity: 0; transform: scale(0.94) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes otpShake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
        @keyframes successPop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
        .acc-input:focus { border-color: #1e8760!important; box-shadow: 0 0 0 3px rgba(30,135,96,0.10)!important; }
        .acc-pw-input:focus { border-color: #1e8760!important; box-shadow: 0 0 0 3px rgba(30,135,96,0.10)!important; }
        .acc-close-btn:hover { background: #f0f8f4!important; color: #0c1c14!important; }
        .acc-cancel-btn:hover { background: #f0f8f4!important; }
        .acc-save-btn:hover:not(:disabled) { background: #1a3325!important; }
        .acc-eye-btn:hover { color: #0c1c14!important; }
        .acc-modal-scroll::-webkit-scrollbar { display: none; }
        .acc-modal-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {showOtpModal && (
        <OTPModal email={user?.email} onVerified={handleOtpVerified} onCancel={() => setShowOtpModal(false)} />
      )}

      {showSuccessModal && <SuccessModal onClose={handleSuccessClose} />}

      <div style={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
        <div style={styles.modal} className="acc-modal-scroll" role="dialog" aria-modal="true" aria-label="Account Settings">
          {/* ── Header ── */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <div style={styles.avatarLarge}>{initials}</div>
              <div style={styles.headerText}>
                <h2 style={styles.title}>Account Settings</h2>
                <p style={styles.subtitle}>Update your profile information</p>
              </div>
            </div>
            <button style={styles.closeBtn} className="acc-close-btn" onClick={onClose} aria-label="Close">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: "flex", borderBottom: "1px solid #eaf3ee", padding: "0 28px" }}>
            {["profile", "password"].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setPwStatus(null);
                  setPwErrorMsg("");
                }}
                style={{
                  padding: "12px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: activeTab === tab ? "#0c1c14" : "#9ab8a9",
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid #1e8760" : "2px solid transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  marginBottom: -1,
                  transition: "color 0.15s",
                }}
              >
                {tab === "profile" ? "Profile" : "Change Password"}
              </button>
            ))}
          </div>

          {/* ── Body ── */}
          <div style={{ ...styles.body, overflowY: "auto", flex: 1 }}>
            
            {/* ── PROFILE TAB ── */}
            {activeTab === "profile" && (
              <>
                <div style={styles.section}>
                  <p style={styles.sectionLabel}>Account Info</p>
                  <div style={styles.readOnlyRow}>
                    <i className="ti ti-mail" style={styles.readOnlyIcon} aria-hidden="true" />
                    <div style={styles.readOnlyContent}>
                      <p style={styles.readOnlyKey}>Email</p>
                      <p style={styles.readOnlyVal}>{user?.email || "—"}</p>
                    </div>
                  </div>
                  <div style={styles.readOnlyRow}>
                    <i className="ti ti-shield-check" style={styles.readOnlyIcon} aria-hidden="true" />
                    <div style={styles.readOnlyContent}>
                      <p style={styles.readOnlyKey}>Role</p>
                      <p style={styles.readOnlyVal} className="capitalize">{user?.role || "admin"}</p>
                    </div>
                  </div>
                  <div style={{ ...styles.readOnlyRow, marginTop: 8 }}>
                    <i className="ti ti-clock" style={styles.readOnlyIcon} aria-hidden="true" />
                    <div style={styles.readOnlyContent}>
                      <p style={styles.readOnlyKey}>Last Login</p>
                      <p style={styles.readOnlyVal}>{formattedLastLogin}</p>
                    </div>
                  </div>
                </div>
                <div style={styles.section}>
                  <div style={styles.row2}>
                    <div style={styles.readOnlyRow}>
                      <div style={styles.readOnlyContent}>
                        <p style={styles.readOnlyKey}>First Name</p>
                        <p style={styles.readOnlyVal}>{user?.firstName || "—"}</p>
                      </div>
                    </div>
                  <div style={styles.readOnlyRow}>
                      <div style={styles.readOnlyContent}>
                        <p style={styles.readOnlyKey}>Last Name</p>
                        <p style={styles.readOnlyVal}>{user?.lastName || "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── PASSWORD TAB ── */}
            {activeTab === "password" && (() => {
              const pw = pwForm.newPassword;
              const hasUpper = /[A-Z]/.test(pw);
              const hasNumber = /[0-9]/.test(pw);
              const hasLength = pw.length >= 8;
              const strength = [hasUpper, hasNumber, hasLength].filter(Boolean).length;
              const strengthLabel = pw.length === 0 ? "" : strength === 1 ? "Weak" : strength === 2 ? "Fair" : "Strong";
              const strengthColor = strength === 1 ? "#c13515" : strength === 2 ? "#f59e0b" : "#1e8760";
              const checks = [
                { label: "At least 1 uppercase", ok: hasUpper },
                { label: "At least 1 number", ok: hasNumber },
                { label: "At least 8 characters", ok: hasLength },
              ];

              return (
                <div style={{ ...styles.section, marginBottom: 8 }}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="acc-currentPw">
                      Current Password <span style={{ color: "#c13515" }}>*</span>
                    </label>
                    <div style={styles.pwInputWrap}>
                      <input id="acc-currentPw" className="acc-pw-input" style={styles.pwInput} type={showPw.current ? "text" : "password"} name="currentPassword" value={pwForm.currentPassword} onChange={handlePwChange} placeholder="Enter current password" autoComplete="current-password" />
                      <button type="button" className="acc-eye-btn" style={styles.eyeBtn} onClick={() => setShowPw((p) => ({ ...p, current: !p.current }))} tabIndex={-1}>
                        <i className={showPw.current ? "ti ti-eye-off" : "ti ti-eye"} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="acc-newPw">
                      New Password <span style={{ color: "#c13515" }}>*</span>
                    </label>
                    <div style={styles.pwInputWrap}>
                      <input id="acc-newPw" className="acc-pw-input" style={styles.pwInput} type={showPw.next ? "text" : "password"} name="newPassword" value={pwForm.newPassword} onChange={handlePwChange} placeholder="At least 8 characters" autoComplete="new-password" />
                      <button type="button" className="acc-eye-btn" style={styles.eyeBtn} onClick={() => setShowPw((p) => ({ ...p, next: !p.next }))} tabIndex={-1}>
                        <i className={showPw.next ? "ti ti-eye-off" : "ti ti-eye"} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div style={{ ...styles.fieldGroup, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ ...styles.label, marginBottom: 0 }} htmlFor="acc-confirmPw">
                        Confirm New Password <span style={{ color: "#c13515" }}>*</span>
                      </label>
                      {pwForm.confirmPassword && (
                        <button type="button" onClick={() => setPwForm(p => ({ ...p, confirmPassword: "" }))} style={{ fontSize: 12, fontWeight: 600, color: "#9ab8a9", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Clear</button>
                      )}
                    </div>
                    <div style={styles.pwInputWrap}>
                      <input id="acc-confirmPw" className="acc-pw-input" style={styles.pwInput} type={showPw.confirm ? "text" : "password"} name="confirmPassword" value={pwForm.confirmPassword} onChange={handlePwChange} placeholder="Re-enter new password" autoComplete="new-password" />
                      <button type="button" className="acc-eye-btn" style={styles.eyeBtn} onClick={() => setShowPw((p) => ({ ...p, confirm: !p.confirm }))} tabIndex={-1}>
                        <i className={showPw.confirm ? "ti ti-eye-off" : "ti ti-eye"} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Strength bar */}
                  {pw.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                        {[1, 2, 3].map((s) => (
                          <div key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: s <= strength ? strengthColor : "#e3ede8", transition: "background 0.2s" }} />
                        ))}
                      </div>
                      {strengthLabel && (
                        <p style={{ fontSize: 12, color: strengthColor, fontWeight: 600, margin: 0 }}>
                          {strengthLabel} password. {strength < 3 ? "Must contain;" : "Looks good!"}
                        </p>
                      )}
                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                        {checks.map((c) => (
                          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: c.ok ? "#1e8760" : "#9ab8a9" }}>
                            <i className={c.ok ? "ti ti-circle-check-filled" : "ti ti-circle-x"} style={{ fontSize: 14 }} aria-hidden="true" />
                            {c.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {pwStatus === "error" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, marginTop: 4 }}>
                      <i className="ti ti-alert-circle" style={{ color: "#c13515", fontSize: 15 }} aria-hidden="true" />
                      <span style={{ color: "#c13515" }}>{pwErrorMsg}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ── Footer ── */}
          <div style={styles.footer}>
            <div style={styles.btnGroup}>
              <button style={styles.cancelBtn} className="acc-cancel-btn" onClick={onClose} disabled={pwSaving}>
                Discard
              </button>
              {activeTab === "password" && (
                <button style={styles.saveBtn(pwSaving)} className="acc-save-btn" onClick={handleSave} disabled={pwSaving}>
                  {pwSaving ? (
                    <>
                      <i className="ti ti-loader-2" style={{ fontSize: 14, animation: "spin 0.8s linear infinite" }} aria-hidden="true" />
                      Sending code…
                    </>
                  ) : (
                    <>
                      <i className="ti ti-check" style={{ fontSize: 14 }} aria-hidden="true" />
                      Apply Changes
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}