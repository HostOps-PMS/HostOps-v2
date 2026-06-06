import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../AuthContext";
import SwitchAccountModal from "./SwitchAccountModal";

const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? "https://hostpilot-smoobu.onrender.com";

function getEmailFromToken(token) {
  try {
    if (!token) return "";
    const payload = token.split(".")[1];
    if (!payload) return "";
    const normalized = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(normalized));
    return decoded?.email || "";
  } catch {
    return "";
  }
}

function getUserData(auth) {
  let fromStore = auth.getUser();
  // Guard against the { user: { …fields } } wrapper that verifySession
  // previously persisted — unwrap so every field is at the top level.
  if (fromStore && fromStore.user && !fromStore.email && typeof fromStore.user === 'object') {
    fromStore = fromStore.user;
  }
  if (fromStore && (fromStore.businessName || fromStore.firstName)) return fromStore;
  try {
    const token = auth.getToken();
    if (!token) return fromStore || {};
    const payload = token.split(".")[1];
    if (!payload) return fromStore || {};
    const normalized = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return { ...(fromStore || {}), ...JSON.parse(atob(normalized)) };
  } catch {
    return fromStore || {};
  }
}

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
// changePin — POST /auth/change-pin
// ─────────────────────────────────────────────────────────────────
async function changePin({ currentPin, newPin }, auth) {
  const token = auth.getToken();
  const res = await fetch(`${API_BASE}/auth/change-pin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_API_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ currentPin, newPin }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to change PIN. Please try again.");
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
      const userEmail = email || auth.getUser()?.email || getEmailFromToken(auth.getToken());
      if (!userEmail) throw new Error("Could not find your email address. Please try logging in again.");
      await verifyOtp(userEmail, otp);
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
function SuccessModal({ context, onDone }) {
  const isPin = context === "pin";
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
        aria-label={isPin ? "PIN Changed Successfully" : "Password Changed Successfully"}
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
          {isPin ? "PIN Updated!" : "Password Updated!"}
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "#6a8b7c",
            margin: "0 0 24px",
            lineHeight: 1.6,
          }}
        >
          {isPin
            ? "Your PIN has been changed successfully.\nKeep it safe and don't share it with anyone."
            : "Your password has been changed successfully.\nKeep it safe and don't share it with anyone."}
        </p>

        <button
          onClick={onDone}
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
export default function AccountSettingsModal({ isOpen, onClose, onPropertySwitch }) {
  const { getUser, setUser } = useAuth();
  const auth = useAuth();
  const user = getUserData(auth);  
  const accountEmail = user?.email || auth.getUser()?.email || getEmailFromToken(auth.getToken());
  const isStaffUser = user?.isStaff || user?.role === "staff";
  const personName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  const displayName = isStaffUser
    ? personName || "Staff"
    : user?.businessName || "Client";
  const roleLabel = isStaffUser
    ? (user?.staffRole || "Staff")
    : user?.role || "client";
  const accountStatus =
    user?.mustChangePin && user?.mustChangePassword
      ? "Unverified"
      : user?.mustChangePin || user?.mustChangePassword
      ? "Partially Verified"
      : "Verified";

  // ── Password form ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("profile");
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

  // ── PIN form ─────────────────────────────────────────────────────
  const [pinForm, setPinForm] = useState({
    currentPin: "",
    newPin: "",
    confirmPin: "",
  });
  const [pinSaving, setPinSaving] = useState(false);
  const [pinStatus, setPinStatus] = useState(null);
  const [pinErrorMsg, setPinErrorMsg] = useState("");
  const [showPin, setShowPin] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  // ── OTP & success modal state ────────────────────────────────────
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpContext, setOtpContext] = useState(""); // 'password' or 'pin'
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successContext, setSuccessContext] = useState("");

  // ── Switch Account modal state ───────────────────────────────────
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  // Stores the verified OTP token temporarily so we can use it after OTP step
  const verifiedTokenRef = useRef(null);

  const overlayRef = useRef(null);

  // ── Activity log ─────────────────────────────────────────────────
  const [activityLog, setActivityLog] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityFilter, setActivityFilter] = useState('today');

  async function fetchActivityLog() {
    setActivityLoading(true);
    try {
      const token = auth.getToken();
      const res = await fetch(`${API_BASE}/auth/activity-log`, {
        headers: {
          "x-api-key": import.meta.env.VITE_API_KEY,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      console.log("Activity log response:", res.status, data);
      if (res.ok) setActivityLog(data.activityLog || []);
    } catch (e) {
      console.error("Failed to fetch activity log:", e);
    } finally {
      setActivityLoading(false);
    }
  }

  // Reset forms whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab("profile");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwStatus(null);
      setPwErrorMsg("");
      setShowPw({ current: false, next: false, confirm: false });
      
      setPinForm({ currentPin: "", newPin: "", confirmPin: "" });
      setPinStatus(null);
      setPinErrorMsg("");
      setShowPin({ current: false, next: false, confirm: false });

      setShowOtpModal(false);
      setShowSuccessModal(false);
      setSuccessContext("");
      setShowSwitchModal(false);
      verifiedTokenRef.current = null;
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === "Escape" && !showOtpModal && !showSuccessModal && !showSwitchModal) onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, showOtpModal, showSuccessModal, showSwitchModal]);

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
    if (e.target === overlayRef.current && !showOtpModal && !showSuccessModal && !showSwitchModal) onClose();
  }

  function handlePwChange(e) {
    const { name, value } = e.target;
    setPwForm((prev) => ({ ...prev, [name]: value }));
    if (pwStatus) setPwStatus(null);
  }

  function handlePinChange(e) {
    const { name, value } = e.target;
    const val = value.replace(/\D/g, '').slice(0, 6);
    setPinForm((prev) => ({ ...prev, [name]: val }));
    if (pinStatus) setPinStatus(null);
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
      setOtpContext("password");
      setShowOtpModal(true);
    } catch (err) {
      setPwErrorMsg(err.message);
      setPwStatus("error");
    } finally {
      setPwSaving(false);
    }
  }

  async function handleSavePin() {
    const { currentPin, newPin, confirmPin } = pinForm;

    if (!currentPin) {
      setPinErrorMsg("Current PIN is required.");
      setPinStatus("error");
      return;
    }
    if (!newPin || newPin.length !== 6) {
      setPinErrorMsg("New PIN must be exactly 6 digits.");
      setPinStatus("error");
      return;
    }
    if (newPin !== confirmPin) {
      setPinErrorMsg("PINs do not match.");
      setPinStatus("error");
      return;
    }
    if (newPin === currentPin) {
      setPinErrorMsg("New PIN must be different from your current PIN.");
      setPinStatus("error");
      return;
    }

    setPinSaving(true);
    setPinStatus(null);
    setPinErrorMsg("");
    try {
      await sendOtpForPasswordChange(auth);
      setOtpContext("pin");
      setShowOtpModal(true);
    } catch (err) {
      setPinErrorMsg(err.message);
      setPinStatus("error");
    } finally {
      setPinSaving(false);
    }
  }

  // ── Step 2: OTP verified — now actually change the password or PIN ──────
  async function handleOtpVerified(otp) {
    verifiedTokenRef.current = otp;
    setShowOtpModal(false);

    if (otpContext === "password") {
      const { currentPassword, newPassword } = pwForm;

      try {
        const body = await changePassword({ currentPassword, newPassword }, auth);
        if (body.user) setUser(body.user);
        if (body.staff) setUser({ ...body.staff, isStaff: true, role: 'staff' });

        // Reset password form
        setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setShowPw({ current: false, next: false, confirm: false });
        verifiedTokenRef.current = null;

        // Show success modal
        setSuccessContext("password");
        setShowSuccessModal(true);
      } catch (err) {
        setPwErrorMsg(err.message);
        setPwStatus("error");
      }
    } else if (otpContext === "pin") {
      const { currentPin, newPin } = pinForm;

      try {
        const body = await changePin({ currentPin, newPin }, auth);
        if (body.user) setUser(body.user);
        if (body.staff) setUser({ ...body.staff, isStaff: true, role: 'staff' });

        // Reset PIN form
        setPinForm({ currentPin: "", newPin: "", confirmPin: "" });
        setShowPin({ current: false, next: false, confirm: false });
        verifiedTokenRef.current = null;

        // Show success modal
        setSuccessContext("pin");
        setShowSuccessModal(true);
      } catch (err) {
        setPinErrorMsg(err.message);
        setPinStatus("error");
      }
    }
  }

  function handleSuccessClose() {
    setShowSuccessModal(false);
    setActiveTab("profile");
  }

  function handleSuccessDone() {
    setShowSuccessModal(false);
    setActiveTab("profile");
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

  const initials = isStaffUser
    ? [user?.firstName, user?.lastName]
      .filter(Boolean)
      .map((n) => n.charAt(0).toUpperCase())
      .join("") || "U"
    : (user?.businessName || "").charAt(0).toUpperCase() || "U";

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
        .acc-switch-btn:hover { border-color: #1e8760!important; background: #eaf8f1!important; box-shadow: 0 2px 8px rgba(30,135,96,0.08)!important; }
        .acc-modal-scroll::-webkit-scrollbar { display: none; }
        .acc-modal-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* OTP modal layer */}
      {showOtpModal && (
        <OTPModal
          email={accountEmail}
          auth={auth}
          onVerified={handleOtpVerified}
          onCancel={() => setShowOtpModal(false)}
        />
      )}

      {/* Success modal layer */}
      {showSuccessModal && (
        <SuccessModal context={successContext} onDone={handleSuccessDone} />
      )}

      {/* Switch Account modal layer */}
      <SwitchAccountModal
        isOpen={showSwitchModal}
        onClose={() => setShowSwitchModal(false)}
        onSwitch={(property) => {
        setShowSwitchModal(false);

        if (property) {
          onClose(); // close Account Settings

          setTimeout(() => {
            onPropertySwitch?.(property.id, property.name);
          }, 0);
        }
      }}
      />

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
            <button
              style={styles.closeBtn}
              className="acc-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>

          {/* ── Switch Account Button ── */}
          <div style={{ padding: "16px 28px 0" }}>
            <button
              onClick={() => setShowSwitchModal(true)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 12,
                border: "1.5px solid #eaf3ee",
                background: "#f7faf8",
                cursor: "pointer",
                transition: "all 0.18s ease",
                fontFamily: "inherit",
              }}
              className="acc-switch-btn"
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #eaf8f1 0%, #d1f0e3 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <i className="ti ti-arrows-exchange" style={{ fontSize: 17, color: "#1e8760" }} aria-hidden="true" />
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0c1c14", margin: 0 }}>Switch Property</p>
                <p style={{ fontSize: 11, color: "#9ab8a9", margin: "2px 0 0" }}>Change active properties</p>
              </div>
              <i className="ti ti-chevron-right" style={{ fontSize: 16, color: "#9ab8a9" }} aria-hidden="true" />
            </button>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: "flex", borderBottom: "1px solid #eaf3ee", padding: "0 28px" }}>
            {["profile", "password", "pin", "activity"].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setPwStatus(null);
                  setPwErrorMsg("");
                  setPinStatus(null);
                  setPinErrorMsg("");
                  if (tab === "activity") fetchActivityLog();
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
                {tab === "profile" ? "Profile" : tab === "password" ? "Change Password" : tab === "pin" ? "Change PIN" : "Activity"}
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
                      <p style={styles.readOnlyVal}>{accountEmail || "—"}</p>
                    </div>
                  </div>
                  <div style={styles.readOnlyRow}>
                    <i className="ti ti-shield-check" style={styles.readOnlyIcon} aria-hidden="true" />
                    <div style={styles.readOnlyContent}>
                      <p style={styles.readOnlyKey}>Role</p>
                      <p style={styles.readOnlyVal} className="capitalize">{roleLabel}</p>
                    </div>
                  </div>
                  <div style={{ ...styles.readOnlyRow, marginTop: 8 }}>
                    <i className="ti ti-check" style={styles.readOnlyIcon} aria-hidden="true" />
                    <div style={styles.readOnlyContent}>
                      <p style={styles.readOnlyKey}>Account Status</p>
                      <p style={styles.readOnlyVal}>{accountStatus}</p>
                    </div>
                  </div>
                </div>
                {isStaffUser ? (
                  <div style={styles.section}>
                    <div style={styles.row2}>
                      <div style={styles.readOnlyRow}>
                        <i className="ti ti-signature" style={styles.readOnlyIcon} aria-hidden="true" />
                        <div style={styles.readOnlyContent}>
                          <p style={styles.readOnlyKey}>First Name</p>
                          <p style={styles.readOnlyVal}>{user?.firstName || "—"}</p>
                        </div>
                      </div>
                      <div style={styles.readOnlyRow}>
                        <i className="ti ti-signature" style={styles.readOnlyIcon} aria-hidden="true" />
                        <div style={styles.readOnlyContent}>
                          <p style={styles.readOnlyKey}>Last Name</p>
                          <p style={styles.readOnlyVal}>{user?.lastName || "—"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={styles.section}>
                    <div style={styles.readOnlyRow}>
                      <i className="ti ti-user" style={styles.readOnlyIcon} aria-hidden="true" />
                      <div style={styles.readOnlyContent}>
                        <p style={styles.readOnlyKey}>Business Name</p>
                        <p style={styles.readOnlyVal}>{user?.businessName || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}
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
                  {/* Current password */}
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

                  {/* New password */}
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

                  {/* Confirm password */}
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

            {/* ── PIN TAB ── */}
            {activeTab === "pin" && (() => {
              const pin = pinForm.newPin;
              const hasLength = pin.length === 6;
              const strength = hasLength ? 3 : (pin.length > 0 ? 1 : 0);
              const strengthLabel = pin.length === 0 ? "" : strength < 3 ? "Too short" : "Looks good!";
              const strengthColor = strength === 1 ? "#c13515" : "#1e8760";
              const checks = [
                { label: "Exactly 6 digits", ok: hasLength },
              ];

              return (
                <div style={{ ...styles.section, marginBottom: 8 }}>
                  {/* Current PIN */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="acc-currentPin">
                      Current PIN <span style={{ color: "#c13515" }}>*</span>
                    </label>
                    <div style={styles.pwInputWrap}>
                      <input id="acc-currentPin" className="acc-pw-input" style={styles.pwInput} type={showPin.current ? "text" : "password"} inputMode="numeric" name="currentPin" value={pinForm.currentPin} onChange={handlePinChange} placeholder="Enter current PIN" />
                      <button type="button" className="acc-eye-btn" style={styles.eyeBtn} onClick={() => setShowPin((p) => ({ ...p, current: !p.current }))} tabIndex={-1}>
                        <i className={showPin.current ? "ti ti-eye-off" : "ti ti-eye"} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* New PIN */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.label} htmlFor="acc-newPin">
                      New PIN <span style={{ color: "#c13515" }}>*</span>
                    </label>
                    <div style={styles.pwInputWrap}>
                      <input id="acc-newPin" className="acc-pw-input" style={styles.pwInput} type={showPin.next ? "text" : "password"} inputMode="numeric" name="newPin" value={pinForm.newPin} onChange={handlePinChange} placeholder="6 digits" />
                      <button type="button" className="acc-eye-btn" style={styles.eyeBtn} onClick={() => setShowPin((p) => ({ ...p, next: !p.next }))} tabIndex={-1}>
                        <i className={showPin.next ? "ti ti-eye-off" : "ti ti-eye"} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Confirm PIN */}
                  <div style={{ ...styles.fieldGroup, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ ...styles.label, marginBottom: 0 }} htmlFor="acc-confirmPin">
                        Confirm New PIN <span style={{ color: "#c13515" }}>*</span>
                      </label>
                      {pinForm.confirmPin && (
                        <button type="button" onClick={() => setPinForm(p => ({ ...p, confirmPin: "" }))} style={{ fontSize: 12, fontWeight: 600, color: "#9ab8a9", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Clear</button>
                      )}
                    </div>
                    <div style={styles.pwInputWrap}>
                      <input id="acc-confirmPin" className="acc-pw-input" style={styles.pwInput} type={showPin.confirm ? "text" : "password"} inputMode="numeric" name="confirmPin" value={pinForm.confirmPin} onChange={handlePinChange} placeholder="Re-enter new PIN" />
                      <button type="button" className="acc-eye-btn" style={styles.eyeBtn} onClick={() => setShowPin((p) => ({ ...p, confirm: !p.confirm }))} tabIndex={-1}>
                        <i className={showPin.confirm ? "ti ti-eye-off" : "ti ti-eye"} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Strength bar */}
                  {pin.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      {strengthLabel && (
                        <p style={{ fontSize: 12, color: strengthColor, fontWeight: 600, margin: 0 }}>
                          {strengthLabel}
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
                  {pinStatus === "error" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, marginTop: 4 }}>
                      <i className="ti ti-alert-circle" style={{ color: "#c13515", fontSize: 15 }} aria-hidden="true" />
                      <span style={{ color: "#c13515" }}>{pinErrorMsg}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── ACTIVITY TAB ── */}
            {activeTab === "activity" && (() => {
              const now = new Date();
              const filtered = activityLog.filter((e) => {
                const d = new Date(e.timestamp);
                if (activityFilter === 'today') {
                  return d.toDateString() === now.toDateString();
                }
                if (activityFilter === 'week') {
                  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
                  return d >= weekAgo;
                }
                return true; // 'all'
              });
              return (
              <div style={{ ...styles.section, marginBottom: 8 }}>
                <div style={{ position: 'sticky', top: -24, background: '#fff', zIndex: 10, paddingTop: 4, paddingBottom: 8, marginBottom: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ ...styles.sectionLabel, marginBottom: 0 }}>Login & Security Activity</p>
                  <button
                    onClick={() => {
                      const rows = activityLog.map((e) => {
                        const actionLabels = {
                          login: 'Logged in',
                          password_changed: 'Password changed',
                          opened_account_settings: 'Opened account settings',
                          exported_pdf: 'Exported PDF report',
                          changed_date_filter: 'Changed date filter',
                          filtered_by_channel: 'Filtered by channel',
                          switched_calendar_view: 'Switched calendar view',
                          opened_message_thread: 'Opened message thread',
                        };
                        const label = actionLabels[e.action] || e.action;
                        const time = new Date(e.timestamp).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
                        return `"${label}","${time}","${e.ipAddress || ''}"`;
                      });
                      const csv = ['Action,Date & Time,IP Address', ...rows].join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    disabled={filtered.length === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: '1px solid #d4e8dd', background: activityLog.length === 0 ? '#f7faf8' : '#eaf8f1', color: activityLog.length === 0 ? '#9ab8a9' : '#1e8760', fontSize: 12, fontWeight: 600, cursor: activityLog.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                  >
                    <i className="ti ti-download" style={{ fontSize: 13 }} />
                    Export CSV
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[{id:'today',label:'Today'},{id:'week',label:'Last 7 days'},{id:'all',label:'All time'}].map((f) => (
                    <button key={f.id} onClick={() => setActivityFilter(f.id)} style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid', borderColor: activityFilter === f.id ? '#1e8760' : '#d4e8dd', background: activityFilter === f.id ? '#eaf8f1' : 'transparent', color: activityFilter === f.id ? '#1e8760' : '#9ab8a9', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{f.label}</button>
                  ))}
                </div>
                </div>
                {activityLoading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 0", gap: 10, color: "#9ab8a9", fontSize: 13 }}>
                    <i className="ti ti-loader-2" style={{ fontSize: 18, animation: "spin 0.8s linear infinite" }} />
                    Loading activity…
                  </div>
                ) : filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0" }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f0f8f4", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                      <i className="ti ti-history" style={{ fontSize: 22, color: "#9ab8a9" }} />
                    </div>
                    <p style={{ fontSize: 13, color: "#9ab8a9", margin: 0 }}>No activity recorded yet.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "340px", overflowY: "auto", paddingRight: 2 }}>
                    {filtered.map((entry, i) => {
                      const isLogin = entry.action === "login";
                      const isPwChange = entry.action === "password_changed";
                      const icon = isLogin ? "ti-login" : isPwChange ? "ti-lock" : "ti-info-circle";
                      const iconColor = isLogin ? "#1e8760" : isPwChange ? "#f59e0b" : "#9ab8a9";
                      const iconBg = isLogin ? "#eaf8f1" : isPwChange ? "#fffbeb" : "#f7faf8";
                      const label = isLogin ? "Logged in" : isPwChange ? "Password changed" : entry.action;
                      const time = new Date(entry.timestamp).toLocaleString("en-PH", {
                        month: "short", day: "numeric", year: "numeric",
                        hour: "numeric", minute: "2-digit", hour12: true,
                      });
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", background: "#f7faf8", borderRadius: 12, border: "1px solid #eaf3ee" }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <i className={`ti ${icon}`} style={{ fontSize: 16, color: iconColor }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0c1c14", marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 11, color: "#9ab8a9" }}>{time}</div>
                              {entry.performedBy && (entry.performedBy.email || entry.performedBy.firstName) && (
                              <div style={{ fontSize: 11, color: "#b0c8ba", marginTop: 2 }}>
                                By: {[entry.performedBy.firstName, entry.performedBy.lastName].filter(Boolean).join(" ") || entry.performedBy.email} ({entry.performedBy.role || "client"})
                              </div>
                            )}
                            {entry.ipAddress && (
                              <div style={{ fontSize: 11, color: "#b0c8ba", marginTop: 2 }}>
                                IP: {entry.ipAddress}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: iconBg, color: iconColor, flexShrink: 0, alignSelf: "flex-start" }}>
                            {isLogin ? "Login" : isPwChange ? "Security" : "Event"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              );
            })()}
          </div>

          {/* ── Footer ── */}
          <div style={{ ...styles.footer, justifyContent: "flex-end" }}>
            <div style={styles.btnGroup}>
              <button style={styles.cancelBtn} className="acc-cancel-btn" onClick={onClose} disabled={pwSaving || pinSaving}>
                Cancel
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
              {activeTab === "pin" && (
                <button style={styles.saveBtn(pinSaving)} className="acc-save-btn" onClick={handleSavePin} disabled={pinSaving}>
                  {pinSaving ? (
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
