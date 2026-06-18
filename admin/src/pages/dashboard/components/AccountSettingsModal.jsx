import React, { useState, useEffect, useRef } from "react";
import { sendLoginOtp, verifyOtp } from "../../authorization/services/authService";
import { authHeaders } from "../../../lib/authUtils";

const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? "https://api.hostops.online";
const API_KEY  = import.meta.env.VITE_API_KEY ?? '';

async function setupTotp() {
  const token = sessionStorage.getItem("hp_access_token");
  const res = await fetch(`${API_BASE}/auth/totp/setup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to start setup.");
  return data; // { secret, qrCode }
}

async function verifyTotpSetup(token6, deviceName) {
  const token = sessionStorage.getItem("hp_access_token");
  const res = await fetch(`${API_BASE}/auth/totp/verify-setup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify({ token: token6, deviceName: deviceName }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Invalid code.");
  return data;
}

async function disableTotp() {
  const token = sessionStorage.getItem("hp_access_token");
  const res = await fetch(`${API_BASE}/auth/totp/disable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to disable.");
  return data;
}

// -----------------------------------------------------------------
// changeAdminPassword
// -----------------------------------------------------------------
async function fetchTotpDevices() {
  const token = sessionStorage.getItem("hp_access_token");
  const res = await fetch(`${API_BASE}/auth/totp/devices`, {
    headers: { "x-api-key": API_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  return data.devices || [];
}

async function deleteTotpDevice(deviceId) {
  const token = sessionStorage.getItem("hp_access_token");
  await fetch(`${API_BASE}/auth/totp/devices/${deviceId}`, {
    method: "DELETE",
    headers: { "x-api-key": API_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: "include",
  });
}

async function changeAdminPassword({ currentPassword, newPassword }) {
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to change password. Please try again.");
  return data;
}

import OTPModal from '../../../components/OTPModal';
import { getSecureUser, setSecureUser } from "../../../lib/secureUserStorage";
import { useTheme } from '../../../context/ThemeContext';

// -----------------------------------------------------------------
// SuccessModal -- shown after password is changed successfully
// -----------------------------------------------------------------
function SuccessModal({ onClose }) {
  const { dark } = useTheme();
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: dark ? "rgba(0,0,0,0.75)" : "rgba(12,28,20,0.6)",
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
          background: dark ? "#132a1e" : "#fff",
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
            color: dark ? "#eaf5f0" : "#0c1c14",
            margin: "0 0 8px",
          }}
        >
          Password Updated!
        </h3>
        <p style={{ fontSize: 13, color: dark ? "#7ab89a" : "#6a8b7c", margin: "0 0 24px", lineHeight: 1.6 }}>
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
            background: dark ? "#1a9e6e" : "#0c1c14",
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
    try { return getSecureUser() || {}; } catch { return {}; }
  };
  const user = getUser();

  const { dark } = useTheme();
  const [activeTab, setActiveTab] = useState("profile");
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwStatus, setPwStatus] = useState(null);
  const [pwErrorMsg, setPwErrorMsg] = useState("");
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const verifiedTokenRef = useRef(null);

  // -- Security / TOTP state --
  const [totpEnabled, setTotpEnabled] = useState(user?.totpEnabled ?? false);
  const [totpStep, setTotpStep] = useState('idle'); // 'idle' | 'qr' | 'verify' | 'done' | 'disabling'
  const [totpQr, setTotpQr] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [devices, setDevices] = useState([]);
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpMsg, setTotpMsg] = useState(null); // { text, type }
  const [allowAdminRememberMe, setAllowAdminRememberMe] = useState(user?.allowAdminRememberMe ?? true);
  const [togglingRm, setTogglingRm] = useState(false);

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
      setAllowAdminRememberMe(user?.allowAdminRememberMe ?? true);
    }
    setTotpStep('idle');
    setTotpCode('');
    setTotpMsg(null);
    setDeviceName('');
    setAllowAdminRememberMe(user?.allowAdminRememberMe ?? true);
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
    if (isOpen && totpEnabled) {
      fetchTotpDevices().then(setDevices);
    }
  }, [isOpen, totpEnabled]);

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
        setSecureUser(body.user);
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
      background: dark ? "rgba(0,0,0,0.65)" : "rgba(12, 28, 20, 0.45)",
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
      zIndex: 10000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    },
    modal: {
      background: dark ? "#132a1e" : "#fff",
      borderRadius: "20px",
      width: "100%",
      maxWidth: "480px",
      maxHeight: "80vh",
      overflowY: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: dark
        ? "0 24px 64px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)"
        : "0 24px 64px rgba(12,28,20,0.18), 0 4px 16px rgba(12,28,20,0.08)",
      position: "relative",
      animation: "modalSlideIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
    },
    header: {
      padding: "24px 28px 20px",
      borderBottom: `1px solid ${dark ? "#1e3a2a" : "#eaf3ee"}`,
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
      background: dark ? "#1a9e6e" : "#0c1c14",
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
      color: dark ? "#eaf5f0" : "#0c1c14",
      margin: 0,
      lineHeight: 1.2,
    },
    subtitle: {
      fontSize: "12px",
      color: dark ? "#4d8a6a" : "#9ab8a9",
      margin: "4px 0 0",
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      border: `1px solid ${dark ? "#1e3a2a" : "#e0ede6"}`,
      background: "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: dark ? "#4d8a6a" : "#6a8b7c",
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
      color: dark ? "#4d8a6a" : "#9ab8a9",
      textTransform: "uppercase",
      marginBottom: 12,
    },
    readOnlyRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 14px",
      background: dark ? "#0d2619" : "#f7faf8",
      borderRadius: 10,
      border: `1px solid ${dark ? "#1e3a2a" : "#eaf3ee"}`,
      marginBottom: 8,
    },
    readOnlyIcon: {
      fontSize: 14,
      color: dark ? "#4d8a6a" : "#9ab8a9",
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
      color: dark ? "#4d8a6a" : "#9ab8a9",
      fontWeight: 600,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      marginBottom: 1,
    },
    readOnlyVal: {
      fontSize: "13px",
      color: dark ? "#eaf5f0" : "#0c1c14",
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
      color: dark ? "#7ab89a" : "#4a6b5a",
      marginBottom: 6,
    },
    input: {
      width: "100%",
      padding: "10px 14px",
      borderRadius: 10,
      border: `1.5px solid ${dark ? "#1e3a2a" : "#d4e8dd"}`,
      fontSize: "13px",
      color: dark ? "#eaf5f0" : "#0c1c14",
      background: dark ? "#0d2619" : "#fff",
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
      border: `1.5px solid ${dark ? "#1e3a2a" : "#d4e8dd"}`,
      fontSize: "13px",
      color: dark ? "#eaf5f0" : "#0c1c14",
      background: dark ? "#0d2619" : "#fff",
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
      color: dark ? "#4d8a6a" : "#9ab8a9",
      fontSize: 15,
      padding: 0,
      display: "flex",
      alignItems: "center",
      lineHeight: 1,
    },
    divider: {
      height: 1,
      background: dark ? "#1e3a2a" : "#eaf3ee",
      margin: "4px 0 20px",
    },
    footer: {
      padding: "16px 28px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 10,
      borderTop: `1px solid ${dark ? "#1e3a2a" : "#eaf3ee"}`,
    },
    btnGroup: {
      display: "flex",
      gap: 8,
    },
    cancelBtn: {
      padding: "9px 18px",
      borderRadius: 10,
      border: `1.5px solid ${dark ? "#1e3a2a" : "#d4e8dd"}`,
      background: "transparent",
      fontSize: "13px",
      fontWeight: 600,
      color: dark ? "#7ab89a" : "#4a6b5a",
      cursor: "pointer",
      transition: "background 0.15s",
    },
    saveBtn: (isSaving) => ({
      padding: "9px 22px",
      borderRadius: 10,
      border: "none",
      background: isSaving ? "#9ab8a9" : (dark ? "#1a9e6e" : "#0c1c14"),
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
    : "-";

  return (
    <>
      <style>{`
        @keyframes modalSlideIn { from { opacity: 0; transform: scale(0.94) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes otpShake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
        @keyframes successPop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
        .acc-input:focus { border-color: #1e8760!important; box-shadow: 0 0 0 3px rgba(30,135,96,0.10)!important; }
        .acc-pw-input:focus { border-color: #1e8760!important; box-shadow: 0 0 0 3px rgba(30,135,96,0.10)!important; }
        .acc-close-btn:hover { background: ${dark ? "#0d2619" : "#f0f8f4"}!important; color: ${dark ? "#eaf5f0" : "#0c1c14"}!important; }
        .acc-cancel-btn:hover { background: ${dark ? "#0d2619" : "#f0f8f4"}!important; }
        .acc-save-btn:hover:not(:disabled) { background: ${dark ? "#17b87a" : "#1a3325"}!important; }
        .acc-eye-btn:hover { color: ${dark ? "#eaf5f0" : "#0c1c14"}!important; }
        .acc-modal-scroll::-webkit-scrollbar { display: none; }
        .acc-modal-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {showOtpModal && (
        <OTPModal email={user?.email} onVerified={handleOtpVerified} onCancel={() => setShowOtpModal(false)} />
      )}

      {showSuccessModal && <SuccessModal onClose={handleSuccessClose} />}

      <div style={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
        <div style={styles.modal} className="acc-modal-scroll" role="dialog" aria-modal="true" aria-label="Account Settings">
          {/* -- Header -- */}
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

          {/* -- Tabs -- */}
          <div style={{ display: "flex", borderBottom: `1px solid ${dark ? "#1e3a2a" : "#eaf3ee"}`, padding: "0 28px" }}>
            {["profile", "password", "security"].map((tab) => (
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
                  color: activeTab === tab ? (dark ? "#eaf5f0" : "#0c1c14") : (dark ? "#4d8a6a" : "#9ab8a9"),
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid #1e8760" : "2px solid transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  marginBottom: -1,
                  transition: "color 0.15s",
                }}
              >
                {tab === "profile" ? "Profile" : tab === "password" ? "Change Password" : "Security"}
              </button>
            ))}
          </div>

          {/* -- Body -- */}
          <div style={{ ...styles.body, overflowY: "auto", flex: 1 }}>

            {/* -- PROFILE TAB -- */}
            {activeTab === "profile" && (
              <>
                <div style={styles.section}>
                  <p style={styles.sectionLabel}>Account Info</p>
                  <div style={styles.readOnlyRow}>
                    <i className="ti ti-mail" style={styles.readOnlyIcon} aria-hidden="true" />
                    <div style={styles.readOnlyContent}>
                      <p style={styles.readOnlyKey}>Email</p>
                      <p style={styles.readOnlyVal}>{user?.email || "-"}</p>
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
                      <i className="ti ti-signature" style={styles.readOnlyIcon} aria-hidden="true" />
                      <div style={styles.readOnlyContent}>
                        <p style={styles.readOnlyKey}>First Name</p>
                        <p style={styles.readOnlyVal}>{user?.firstName || "-"}</p>
                      </div>
                    </div>
                    <div style={styles.readOnlyRow}>
                      <i className="ti ti-signature" style={styles.readOnlyIcon} aria-hidden="true" />
                      <div style={styles.readOnlyContent}>
                        <p style={styles.readOnlyKey}>Last Name</p>
                        <p style={styles.readOnlyVal}>{user?.lastName || "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* -- SECURITY TAB -- */}
            {activeTab === "security" && (
              <div style={styles.section}>
                <p style={styles.sectionLabel}>Authenticator App</p>

                {/* Status row for TOTP */}
                <div style={{ ...styles.readOnlyRow, marginBottom: 16, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <i className="ti ti-device-mobile" style={{ ...styles.readOnlyIcon, fontSize: 18 }} />
                    <div>
                      <p style={styles.readOnlyKey}>Two-Factor Authentication</p>
                      <p style={{ ...styles.readOnlyVal, color: totpEnabled ? '#1e8760' : (dark ? '#4d8a6a' : '#9ab8a9') }}>
                        {totpEnabled ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                  <div style={{
                    width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                    background: totpEnabled ? '#1e8760' : (dark ? '#1e3a2a' : '#d4e8dd'),
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }} onClick={async () => {
                    if (totpEnabled) {
                      setTotpStep('disabling');
                      setTotpMsg(null);
                    } else {
                      setTotpLoading(true);
                      setTotpMsg(null);
                      try {
                        const { secret, qrCode } = await setupTotp();
                        setTotpQr(qrCode);
                        setTotpSecret(secret);
                        setTotpStep('qr');
                      } catch (err) {
                        setTotpMsg({ text: err.message, type: 'error' });
                      } finally {
                        setTotpLoading(false);
                      }
                    }
                  }}>
                    <div style={{
                      position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                      left: totpEnabled ? 19 : 3,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                    }} />
                  </div>
                </div>

                <div style={{ ...styles.divider, marginTop: 16, marginBottom: 16 }} />
                
                <p style={styles.sectionLabel}>Login Preferences</p>

                {/* Status row for Admin Remember Me */}
                <div style={{ ...styles.readOnlyRow, marginBottom: 16, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <i className="ti ti-device-floppy" style={{ ...styles.readOnlyIcon, fontSize: 18 }} />
                    <div>
                      <p style={styles.readOnlyKey}>Allow "Remember Me" for 7 days</p>
                      <p style={{ ...styles.readOnlyVal, color: allowAdminRememberMe ? '#1e8760' : (dark ? '#4d8a6a' : '#9ab8a9') }}>
                        {allowAdminRememberMe ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                  <div style={{
                    width: 36, height: 20, borderRadius: 10, cursor: togglingRm ? 'not-allowed' : 'pointer',
                    background: togglingRm ? '#9ab8a9' : (allowAdminRememberMe ? '#1e8760' : (dark ? '#1e3a2a' : '#d4e8dd')),
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    opacity: togglingRm ? 0.7 : 1,
                  }} onClick={async () => {
                    if (togglingRm) return;
                    setTogglingRm(true);
                    const newValue = !allowAdminRememberMe;
                    try {
                      const token = sessionStorage.getItem("hp_access_token");
                      const res = await fetch(`${API_BASE}/auth/admin-remember-me`, {
                        method: 'PATCH',
                        headers: {
                          "Content-Type": "application/json",
                          "x-api-key": API_KEY,
                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({ enabled: newValue }),
                        credentials: "include"
                      });
                      if (!res.ok) throw new Error();
                      setAllowAdminRememberMe(newValue);
                      const u = getSecureUser();
                      if (u) setSecureUser({ ...u, allowAdminRememberMe: newValue });
                    } catch {
                      // Silently fail or show toast if we had one
                    } finally {
                      setTogglingRm(false);
                    }
                  }}>
                    <div style={{
                      position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                      left: allowAdminRememberMe ? 19 : 3,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                    }} />
                  </div>
                </div>

                {totpMsg && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, marginBottom: 12,
                    color: totpMsg.type === 'error' ? '#c13515' : '#1e8760' }}>
                    <i className={totpMsg.type === 'error' ? 'ti ti-alert-circle' : 'ti ti-circle-check'} style={{ fontSize: 14 }} />
                    {totpMsg.text}
                  </div>
                )}

                {/* QR step */}
                {totpStep === 'qr' && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: dark ? '#7ab89a' : '#4a6b5a', marginBottom: 12, lineHeight: 1.6 }}>
                      Scan this QR code with your authenticator app<br />
                      <strong>(Google Authenticator, Authy, etc.)</strong>
                    </p>
                    <img src={totpQr} alt="QR Code" style={{ width: 180, height: 180, borderRadius: 12, border: `1px solid ${dark ? '#1e3a2a' : '#eaf3ee'}`, marginBottom: 12 }} />
                    <input
                      type="text"
                      placeholder="Device name (e.g. iPhone 13, Work Phone)"
                      value={deviceName}
                      onChange={e => setDeviceName(e.target.value)}
                      style={{ ...styles.input, marginBottom: 12, textAlign: 'center' }}
                      className="acc-input"
                    />
                    <p style={{ fontSize: 11, color: dark ? '#4d8a6a' : '#9ab8a9', marginBottom: 16 }}>
                      Or enter this code manually:<br />
                      <strong style={{ fontSize: 13, color: dark ? '#eaf5f0' : '#0c1c14', letterSpacing: '0.1em', fontFamily: 'monospace' }}>{totpSecret}</strong>
                    </p>
                    <button onClick={() => setTotpStep('verify')} style={{ ...styles.saveBtn(false), width: '100%', justifyContent: 'center' }} className="acc-save-btn">
                      I've scanned it - Next
                    </button>
                    <button onClick={() => { setTotpStep('idle'); setTotpCode(''); setTotpMsg(null); }}
                      style={{ ...styles.cancelBtn, width: '100%', marginTop: 8, textAlign: 'center' }} className="acc-cancel-btn">
                      Cancel
                    </button>
                  </div>
                )}

                {/* Verify step */}
                {totpStep === 'verify' && (
                  <div>
                    <p style={{ fontSize: 12, color: dark ? '#7ab89a' : '#4a6b5a', marginBottom: 12, lineHeight: 1.6 }}>
                      Enter the <strong>6-digit code</strong> from your authenticator app to confirm setup.
                    </p>
                    <input
                      type="text" inputMode="numeric" maxLength={6}
                      placeholder="000000"
                      value={totpCode}
                      onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      style={{ ...styles.input, textAlign: 'center', fontSize: 22, letterSpacing: '0.3em', fontWeight: 700, marginBottom: 12 }}
                      className="acc-input"
                    />
                    <button
                      disabled={totpCode.length < 6 || totpLoading}
                      onClick={async () => {
                        setTotpLoading(true);
                        setTotpMsg(null);
                        try {
                          await verifyTotpSetup(totpCode, deviceName);
                          const u = { ...user, totpEnabled: true };
                          setSecureUser(u);
                          setTotpEnabled(true);
                          setTotpStep('idle');
                          setTotpMsg({ text: 'Authenticator enabled successfully!', type: 'success' });
                          setDevices(prev => [...prev, { name: deviceName || 'Authenticator App', addedAt: new Date().toISOString() }]);
                          setDeviceName('');
                          fetchTotpDevices().then(setDevices);
                          localStorage.removeItem('hp_totp_devices');
                        } catch (err) {
                          setTotpMsg({ text: err.message, type: 'error' });
                          setTotpCode('');
                        } finally {
                          setTotpLoading(false);
                        }
                      }}
                      style={{ ...styles.saveBtn(totpLoading || totpCode.length < 6), width: '100%', justifyContent: 'center' }}
                      className="acc-save-btn"
                    >
                      {totpLoading
                        ? <><i className="ti ti-loader-2" style={{ fontSize: 14, animation: 'spin 0.8s linear infinite' }} />Verifying...</>
                        : <><i className="ti ti-check" style={{ fontSize: 14 }} />Confirm & Enable</>}
                    </button>
                    <button onClick={() => { setTotpStep('qr'); setTotpCode(''); setTotpMsg(null); }}
                      style={{ ...styles.cancelBtn, width: '100%', marginTop: 8, textAlign: 'center' }} className="acc-cancel-btn">
                      Back
                    </button>
                  </div>
                )}

                {/* Disable confirm step */}
                {totpStep === 'disabling' && (
                  <div style={{ background: dark ? '#2a0d0d' : '#fff5f5', border: `1px solid ${dark ? '#5c1a1a' : '#fcd4cc'}`, borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ fontSize: 13, color: '#c13515', fontWeight: 600, marginBottom: 6 }}>
                      Disable Authenticator App?
                    </p>
                    <p style={{ fontSize: 12, color: dark ? '#7ab89a' : '#6a8b7c', marginBottom: 14, lineHeight: 1.6 }}>
                      Your account will be less secure. You can always re-enable it later.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setTotpStep('idle')}
                        style={{ ...styles.cancelBtn, flex: 1 }} className="acc-cancel-btn">
                        Keep it
                      </button>
                      <button
                        disabled={totpLoading}
                        onClick={async () => {
                          setTotpLoading(true);
                          setTotpMsg(null);
                          try {
                            await disableTotp();
                            const u = { ...user, totpEnabled: false };
                            setSecureUser(u);
                            setTotpEnabled(false);
                            setTotpStep('idle');
                            setDevices([]);
                            localStorage.removeItem('hp_totp_devices');
                            setTotpMsg({ text: 'Authenticator disabled.', type: 'success' });
                          } catch (err) {
                            setTotpMsg({ text: err.message, type: 'error' });
                            setTotpStep('idle');
                          } finally {
                            setTotpLoading(false);
                          }
                        }}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
                          background: totpLoading ? '#9ab8a9' : '#c13515', color: '#fff',
                          fontSize: 13, fontWeight: 700, cursor: totpLoading ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        {totpLoading
                          ? <><i className="ti ti-loader-2" style={{ fontSize: 14, animation: 'spin 0.8s linear infinite' }} />Disabling...</>
                          : 'Yes, disable'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Idle info */}
                {totpStep === 'idle' && (
                  <p style={{ fontSize: 12, color: dark ? '#4d8a6a' : '#9ab8a9', lineHeight: 1.6, marginTop: 12, background: dark ? '#0d2619' : '#f7faf8', padding: '10px 14px', borderRadius: 8, border: `1px solid ${dark ? '#1e3a2a' : '#eaf3ee'}` }}>
                    <strong>Note:</strong> Add an extra layer of security to your account. Toggle the switch above to get started.
                  </p>
                )}

                {totpEnabled && devices.length > 0 && totpStep === 'idle' && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: dark ? '#4d8a6a' : '#9ab8a9', textTransform: 'uppercase', marginBottom: 10 }}>
                      Enrolled Devices
                    </p>
                    {devices.map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: dark ? '#0d2619' : '#f7faf8', borderRadius: 10, border: `1px solid ${dark ? '#1e3a2a' : '#eaf3ee'}`, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <i className="ti ti-device-mobile-check" style={{ fontSize: 16, color: '#1e8760' }} />
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: dark ? '#eaf5f0' : '#0c1c14', margin: 0 }}>{d.name}</p>
                            <p style={{ fontSize: 11, color: dark ? '#4d8a6a' : '#9ab8a9', margin: 0 }}>
                              Added {new Date(d.addedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        {devices.length > 1 && (
                          <button
                            onClick={async () => {
                              await deleteTotpDevice(d._id);
                              setDevices(prev => prev.filter((_, idx) => idx !== i));
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#4d8a6a' : '#9ab8a9', fontSize: 14, padding: 4 }}
                            title="Remove device"
                          >
                            <i className="ti ti-trash" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* -- PASSWORD TAB -- */}
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
                        <button type="button" onClick={() => setPwForm(p => ({ ...p, confirmPassword: "" }))} style={{ fontSize: 12, fontWeight: 600, color: dark ? '#4d8a6a' : "#9ab8a9", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Clear</button>
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
                          <div key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: s <= strength ? strengthColor : (dark ? "#1e3a2a" : "#e3ede8"), transition: "background 0.2s" }} />
                        ))}
                      </div>
                      {strengthLabel && (
                        <p style={{ fontSize: 12, color: strengthColor, fontWeight: 600, margin: 0 }}>
                          {strengthLabel} password. {strength < 3 ? "Must contain;" : "Looks good!"}
                        </p>
                      )}
                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                        {checks.map((c) => (
                          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: c.ok ? "#1e8760" : (dark ? "#4d8a6a" : "#9ab8a9") }}>
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

          {/* -- Footer -- */}
          <div style={styles.footer}>
            <div style={styles.btnGroup}>
              <button style={styles.cancelBtn} className="acc-cancel-btn" onClick={onClose} disabled={pwSaving}>
                Cancel
              </button>
              {activeTab === "password" && (
                <button style={styles.saveBtn(pwSaving)} className="acc-save-btn" onClick={handleSave} disabled={pwSaving}>
                  {pwSaving ? (
                    <>
                      <i className="ti ti-loader-2" style={{ fontSize: 14, animation: "spin 0.8s linear infinite" }} aria-hidden="true" />
                      Sending code...
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