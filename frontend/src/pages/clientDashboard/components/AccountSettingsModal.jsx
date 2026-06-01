import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? "http://localhost:5000";

// ─────────────────────────────────────────────────────────────────
// sendOtpForPasswordChange — POST /auth/send-change-password-otp
// Authenticated endpoint — sends an OTP scoped specifically to the
// account-settings password change flow. Works for User, Staff, and
// ClientAccount. Requires a valid Bearer token.
// ─────────────────────────────────────────────────────────────────
async function sendOtpForPasswordChange(auth) {
  const token = auth.getToken();
  const res = await fetch(`${API_BASE}/auth/send-change-password-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_API_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Unable to send OTP.");
  return data;
}

// ─────────────────────────────────────────────────────────────────
// verifyOtp — POST /auth/verify-reset-token
// Verifies the OTP the user entered before changing the password.
// Works for User/ClientAccount (resetToken) and Staff (loginOtp).
// ─────────────────────────────────────────────────────────────────
async function verifyOtp(email, token) {
  const res = await fetch(`${API_BASE}/auth/verify-reset-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_API_KEY,
    },
    body: JSON.stringify({ email, token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Invalid or expired code.");
  return data;
}

// ─────────────────────────────────────────────────────────────────
// changePassword — POST /auth/change-password
// Works for both regular users and staff (backend detects via token).
// ─────────────────────────────────────────────────────────────────
async function changePassword({ currentPassword, newPassword }, auth) {
  const token = auth.getToken();
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

// ─────────────────────────────────────────────────────────────────
// OTPInput — 6-box OTP input, same pattern as the reset page
// ─────────────────────────────────────────────────────────────────
function OTPInput({ length = 6, onComplete, isError, isLoading, version }) {
  const [values, setValues] = useState(Array(length).fill(""));
  const inputRefs = useRef([]);

  // Reset when version changes (resend or re-open)
  useEffect(() => {
    setValues(Array(length).fill(""));
    inputRefs.current[0]?.focus();
  }, [version, length]);

  function handleChange(idx, val) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...values];
    next[idx] = digit;
    setValues(next);
    if (digit && idx < length - 1) inputRefs.current[idx + 1]?.focus();
    const filled = next.join("");
    if (filled.length === length && !next.includes("")) onComplete(filled);
  }

  function handleKeyDown(idx, e) {
    if (e.key === "Backspace") {
      if (values[idx]) {
        const next = [...values];
        next[idx] = "";
        setValues(next);
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus();
      }
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(length).fill("");
    pasted.split("").forEach((d, i) => { next[i] = d; });
    setValues(next);
    const focus = Math.min(pasted.length, length - 1);
    inputRefs.current[focus]?.focus();
    if (pasted.length === length) onComplete(pasted);
  }

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "18px 0 6px" }}>
      {values.map((v, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={v}
          disabled={isLoading}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          style={{
            width: 42,
            height: 48,
            textAlign: "center",
            fontSize: 20,
            fontWeight: 700,
            fontFamily: "'Sora', sans-serif",
            borderRadius: 10,
            border: `2px solid ${isError ? "#c13515" : v ? "#1e8760" : "#d4e8dd"}`,
            background: isError ? "#fff5f3" : "#fff",
            color: isError ? "#c13515" : "#0c1c14",
            outline: "none",
            transition: "border-color 0.15s, background 0.15s",
            boxSizing: "border-box",
            animation: isError ? "otpShake 0.35s ease" : "none",
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// OTPModal — overlay modal for OTP verification step
// ─────────────────────────────────────────────────────────────────
function OTPModal({ email, auth, onVerified, onCancel }) {
  const [otpVersion, setOtpVersion] = useState(0);
  const [otpStatus, setOtpStatus] = useState("idle"); // idle | loading | error
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(60);
  const errorTimerRef = useRef(null);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => () => clearTimeout(errorTimerRef.current), []);

  function clearOtpErrorSoon() {
    clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setOtpStatus("idle");
      setOtpError("");
      setOtpVersion((v) => v + 1);
    }, 700);
  }

  async function handleOtpComplete(otp) {
    setOtpStatus("loading");
    setOtpError("");
    clearTimeout(errorTimerRef.current);
    try {
      await verifyOtp(email, otp);
      clearTimeout(errorTimerRef.current);
      onVerified(otp);
    } catch (err) {
      setOtpStatus("error");
      setOtpError(err.message);
      clearOtpErrorSoon();
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    try {
      await sendOtpForPasswordChange(auth);
      setOtpStatus("idle");
      setOtpError("");
      setOtpVersion((v) => v + 1);
      setResendCooldown(60);
    } catch (err) {
      setOtpError(err.message);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(12,28,20,0.6)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 10100,
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
          maxWidth: 380,
          boxShadow: "0 24px 64px rgba(12,28,20,0.22)",
          animation: "modalSlideIn 0.22s cubic-bezier(0.34,1.56,0.64,1)",
          padding: "28px 28px 24px",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Verify Identity"
      >
        {/* Icon */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "#eaf8f1",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <i className="ti ti-shield-lock" style={{ fontSize: 24, color: "#1e8760" }} aria-hidden="true" />
          </div>
          <h3
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: "1.05rem",
              fontWeight: 800,
              color: "#0c1c14",
              margin: "0 0 6px",
            }}
          >
            Verify your identity
          </h3>
          <p style={{ fontSize: 13, color: "#6a8b7c", margin: 0, lineHeight: 1.5 }}>
            A 6-digit code was sent to{" "}
            <strong style={{ color: "#0c1c14" }}>{email}</strong>.
            <br />Enter it below to continue.
          </p>
        </div>

        {/* OTP boxes */}
        <OTPInput
          key={otpVersion}
          length={6}
          onComplete={handleOtpComplete}
          isError={otpStatus === "error"}
          isLoading={otpStatus === "loading"}
          version={otpVersion}
        />

        {/* Error message */}
        {otpStatus === "error" && (
          <p
            style={{
              color: "#c13515",
              fontSize: "0.82rem",
              textAlign: "center",
              margin: "6px 0 0",
            }}
          >
            {otpError}
          </p>
        )}

        {/* Loading indicator */}
        {otpStatus === "loading" && (
          <p style={{ color: "#9ab8a9", fontSize: "0.82rem", textAlign: "center", margin: "6px 0 0" }}>
            Verifying…
          </p>
        )}

        {/* Resend + Cancel */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 20,
            gap: 10,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              background: "transparent",
              border: "1.5px solid #d4e8dd",
              borderRadius: 10,
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 600,
              color: "#4a6b5a",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0}
            style={{
              background: resendCooldown > 0 ? "#e3ede8" : "#eaf8f1",
              border: "none",
              borderRadius: 10,
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 700,
              color: resendCooldown > 0 ? "#6a8b7c" : "#1e8760",
              cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
        {/* Animated checkmark */}
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
          <i
            className="ti ti-lock-check"
            style={{ fontSize: 30, color: "#1e8760" }}
            aria-hidden="true"
          />
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
        <p
          style={{
            fontSize: 13,
            color: "#6a8b7c",
            margin: "0 0 24px",
            lineHeight: 1.6,
          }}
        >
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

// ─────────────────────────────────────────────────────────────────
// AccountSettingsModal — main component
// ─────────────────────────────────────────────────────────────────
export default function AccountSettingsModal({ isOpen, onClose }) {
  const { getUser, setUser } = useAuth();
  const auth = useAuth();
  const user = getUser();

  // ── Password form ────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwStatus, setPwStatus] = useState(null); // 'error' | null
  const [pwErrorMsg, setPwErrorMsg] = useState("");
  const [showPw, setShowPw] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  // ── OTP & success modal state ────────────────────────────────────
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  // Stores the verified OTP token temporarily so we can use it after OTP step
  const verifiedTokenRef = useRef(null);

  const overlayRef = useRef(null);

  // Reset password form whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwStatus(null);
      setPwErrorMsg("");
      setShowPw({ current: false, next: false, confirm: false });
      setShowOtpModal(false);
      setShowSuccessModal(false);
      verifiedTokenRef.current = null;
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === "Escape" && !showOtpModal && !showSuccessModal) onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, showOtpModal, showSuccessModal]);

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
    if (e.target === overlayRef.current && !showOtpModal && !showSuccessModal) onClose();
  }

  function handlePwChange(e) {
    const { name, value } = e.target;
    setPwForm((prev) => ({ ...prev, [name]: value }));
    if (pwStatus) setPwStatus(null);
  }

  // ── Save Changes: validates pw fields then sends OTP ───────────────
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

    // Send OTP to user's email and open OTP modal
    setPwSaving(true);
    setPwStatus(null);
    setPwErrorMsg("");
    try {
      await sendOtpForPasswordChange(auth);
      setShowOtpModal(true);
    } catch (err) {
      setPwErrorMsg(err.message);
      setPwStatus("error");
    } finally {
      setPwSaving(false);
    }
  }

  // ── Step 2: OTP verified — now actually change the password ──────
  async function handleOtpVerified(otp) {
    verifiedTokenRef.current = otp;
    setShowOtpModal(false);

    const { currentPassword, newPassword } = pwForm;

    try {
      const body = await changePassword({ currentPassword, newPassword }, auth);
      if (body.user) setUser(body.user);

      // Reset password form
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPw({ current: false, next: false, confirm: false });
      verifiedTokenRef.current = null;

      // Show success modal
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
      maxHeight: "90vh",
      overflowY: "auto",
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
    pwFooter: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 4,
    },
    pwStatusMsg: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: "12px",
      fontWeight: 500,
      flex: 1,
    },
  };

  const initials =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .map((n) => n.charAt(0).toUpperCase())
      .join("") || "U";

  const formattedLastLogin = user?.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

  return (
    <>
      <style>{`
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes otpShake {
          0%, 100% { transform: translateX(0); }
          20%      { transform: translateX(-5px); }
          40%      { transform: translateX(5px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
        @keyframes successPop {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        .acc-input:focus {
          border-color: #1e8760!important;
          box-shadow: 0 0 0 3px rgba(30,135,96,0.10)!important;
        }
        .acc-pw-input:focus {
          border-color: #1e8760!important;
          box-shadow: 0 0 0 3px rgba(30,135,96,0.10)!important;
        }
        .acc-close-btn:hover { background: #f0f8f4!important; color: #0c1c14!important; }
        .acc-cancel-btn:hover { background: #f0f8f4!important; }
        .acc-save-btn:hover:not(:disabled) { background: #1a3325!important; }
        .acc-eye-btn:hover { color: #0c1c14!important; }
      `}</style>

      {/* OTP modal layer */}
      {showOtpModal && (
        <OTPModal
          email={user?.email}
          auth={auth}
        onVerified={handleOtpVerified}
          onCancel={() => setShowOtpModal(false)}
        />
      )}

      {/* Success modal layer */}
      {showSuccessModal && (
        <SuccessModal onClose={handleSuccessClose} />
      )}

      <div style={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
        <div style={styles.modal} role="dialog" aria-modal="true" aria-label="Account Settings">

          {/* ── Header ── */}
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

          {/* ── Body ── */}
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

              {/* Role */}
              <div style={styles.readOnlyRow}>
                <i className="ti ti-shield-check" style={styles.readOnlyIcon} aria-hidden="true" />
                <div style={styles.readOnlyContent}>
                  <p style={styles.readOnlyKey}>Role</p>
                  <p style={styles.readOnlyVal} className="capitalize">
                    {user?.role || "client"}
                  </p>
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

            {/* ── Name (read-only) ── */}
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

            {/* ── Divider ── */}
            <div style={styles.divider} />

            {/* ── Change Password section ── */}
            <div style={{ ...styles.section, marginBottom: 8 }}>
              <p style={styles.sectionLabel}>Change Password</p>

              {/* Current password */}
              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="acc-currentPw">Current Password</label>
                <div style={styles.pwInputWrap}>
                  <input
                    id="acc-currentPw"
                    className="acc-pw-input"
                    style={styles.pwInput}
                    type={showPw.current ? "text" : "password"}
                    name="currentPassword"
                    value={pwForm.currentPassword}
                    onChange={handlePwChange}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="acc-eye-btn"
                    style={styles.eyeBtn}
                    onClick={() => setShowPw((p) => ({ ...p, current: !p.current }))}
                    tabIndex={-1}
                    aria-label={showPw.current ? "Hide password" : "Show password"}
                  >
                    <i className={showPw.current ? "ti ti-eye-off" : "ti ti-eye"} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* New password */}
              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="acc-newPw">New Password</label>
                <div style={styles.pwInputWrap}>
                  <input
                    id="acc-newPw"
                    className="acc-pw-input"
                    style={styles.pwInput}
                    type={showPw.next ? "text" : "password"}
                    name="newPassword"
                    value={pwForm.newPassword}
                    onChange={handlePwChange}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="acc-eye-btn"
                    style={styles.eyeBtn}
                    onClick={() => setShowPw((p) => ({ ...p, next: !p.next }))}
                    tabIndex={-1}
                    aria-label={showPw.next ? "Hide password" : "Show password"}
                  >
                    <i className={showPw.next ? "ti ti-eye-off" : "ti ti-eye"} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Confirm new password */}
              <div style={{ ...styles.fieldGroup, marginBottom: 12 }}>
                <label style={styles.label} htmlFor="acc-confirmPw">Confirm New Password</label>
                <div style={styles.pwInputWrap}>
                  <input
                    id="acc-confirmPw"
                    className="acc-pw-input"
                    style={styles.pwInput}
                    type={showPw.confirm ? "text" : "password"}
                    name="confirmPassword"
                    value={pwForm.confirmPassword}
                    onChange={handlePwChange}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="acc-eye-btn"
                    style={styles.eyeBtn}
                    onClick={() => setShowPw((p) => ({ ...p, confirm: !p.confirm }))}
                    tabIndex={-1}
                    aria-label={showPw.confirm ? "Hide password" : "Show password"}
                  >
                    <i className={showPw.confirm ? "ti ti-eye-off" : "ti ti-eye"} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Password error message */}
              {pwStatus === "error" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", fontWeight: 500, marginTop: 4 }}>
                  <i className="ti ti-alert-circle" style={{ color: "#c13515", fontSize: 15 }} aria-hidden="true" />
                  <span style={{ color: "#c13515" }}>{pwErrorMsg}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{ ...styles.footer, justifyContent: "flex-end" }}>
            <div style={styles.btnGroup}>
              <button
                style={styles.cancelBtn}
                className="acc-cancel-btn"
                onClick={onClose}
                disabled={pwSaving}
              >
                Cancel
              </button>
              <button
                style={styles.saveBtn(pwSaving)}
                className="acc-save-btn"
                onClick={handleSave}
                disabled={pwSaving}
              >
                {pwSaving ? (
                  <>
                    <i className="ti ti-loader-2" style={{ fontSize: 14, animation: "spin 0.8s linear infinite" }} aria-hidden="true" />
                    Sending code…
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
    </>
  );
}