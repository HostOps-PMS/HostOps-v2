import React, { useState, useEffect, useRef } from 'react';
import { sendLoginOtp, verifyOtp } from '../pages/authorization/services/authService';

export function OTPInput({ length = 6, onComplete, isError, isLoading, version }) {
  const [values, setValues] = useState(Array(length).fill(""));
  const inputRefs = useRef([]);

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

export default function OTPModal({ email, onVerified, onCancel }) {
  const [otpVersion, setOtpVersion] = useState(0);
  const [otpStatus, setOtpStatus] = useState("idle");
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
      await verifyOtp(otp);
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
      await sendLoginOtp();
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

        <OTPInput
          key={otpVersion}
          length={6}
          onComplete={handleOtpComplete}
          isError={otpStatus === "error"}
          isLoading={otpStatus === "loading"}
          version={otpVersion}
        />

        {otpStatus === "error" && (
          <p style={{ color: "#c13515", fontSize: "0.82rem", textAlign: "center", margin: "6px 0 0" }}>
            {otpError}
          </p>
        )}

        {otpStatus === "loading" && (
          <p style={{ color: "#9ab8a9", fontSize: "0.82rem", textAlign: "center", margin: "6px 0 0" }}>
            Verifying…
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, gap: 10 }}>
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
