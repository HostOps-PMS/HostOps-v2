import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import safeStorage from '../../safeStorage';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://hostpilot-smoobu.onrender.com';
const PIN_LENGTH = 6;

// ─────────────────────────────────────────────────────────────────
// PinModal
//
// Shown after property selection for ALL user types:
//   - staff       → PIN verified against Staff model. Backend also checks
//                   that the selected property is in staff.propertyIds.
//   - client      → PIN verified against their own User doc.
//   - team_leader → PIN verified against their assigned client (serverId) User doc.
//
// Account is identified via the `email` field entered by the user.
// The email is sent to the backend along with the pin and propertyId.
//
// Props:
//   userData           {object}  - user / staff object from authData (used for greeting)
//   selectedPropertyId {string}  - MongoDB _id of the selected property
//   isStaff            {boolean} - hint from parent; truth is confirmed via stored user
//   showMsg            {fn}
//   hideMsg            {fn}
//   onBack             {fn}      - go back to PropertySelectForm
// ─────────────────────────────────────────────────────────────────
export default function PinModal({
  userData,
  selectedPropertyId,
  isStaff = false,
  showMsg,
  hideMsg,
  onBack,
}) {
  const auth = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]   = useState('');
  const [digits, setDigits] = useState(Array(PIN_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [shake, setShake]   = useState(false);

  // ── Lockout state ─────────────────────────────────────────────────
  // lockedUntil: Date object — account is temporarily locked until this time
  // permanentlyLocked: boolean — account is permanently disabled
  // lockSecondsLeft: countdown in seconds for the temp lock timer
  const [lockedUntil, setLockedUntil]           = useState(null);
  const [permanentlyLocked, setPermanentlyLocked] = useState(false);
  const [lockSecondsLeft, setLockSecondsLeft]   = useState(0);

  // ── Recovery modal state ──────────────────────────────────────────
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryReason, setRecoveryReason]       = useState('');
  const [recoveryLoading, setRecoveryLoading]     = useState(false);
  const [recoverySubmitted, setRecoverySubmitted] = useState(false);

  const inputRefs = useRef([]);
  const countdownRef = useRef(null);

  // Greeting name: from prop userData
  const firstName = userData?.firstName || '';

  // Focus first PIN input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // ── Countdown timer for temporary lock ───────────────────────────
  // Ticks every second and clears itself when the lock expires.
  useEffect(() => {
    if (!lockedUntil) return;

    const tick = () => {
      const secondsLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
      if (secondsLeft <= 0) {
        setLockedUntil(null);
        setLockSecondsLeft(0);
        hideMsg();
        clearInterval(countdownRef.current);
      } else {
        setLockSecondsLeft(secondsLeft);
      }
    };

    tick(); // run immediately so display doesn't wait 1s
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current);
  }, [lockedUntil]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-submit when all digits filled ──────────────────────────
  // Only fires if email is also present — prevents bypassing the
  // required email field by just completing the PIN digits.
  useEffect(() => {
    if (digits.every((d) => d !== '') && email.trim()) {
      handleSubmit(digits.join(''));
    }
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const clearDigits = () => {
    setDigits(Array(PIN_LENGTH).fill(''));
    setTimeout(() => inputRefs.current[0]?.focus(), 0);
  };

  // ── Format seconds into a human-readable string ───────────────────
  // e.g. 65 → "1m 5s", 3600 → "1h 0m"
  const formatCountdown = (seconds) => {
    if (seconds >= 3600) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return `${h}h ${m}m`;
    }
    if (seconds >= 60) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}m ${s}s`;
    }
    return `${seconds}s`;
  };

  // ── Handle digit input ───────────────────────────────────────────
  const handleChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next  = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (!pasted) return;
    const next = Array(PIN_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, PIN_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  // ── Submit PIN to backend ────────────────────────────────────────
  // Sends:
  //   email        — entered by user to identify their account
  //   pin          — the entered PIN
  //   propertyId   — MongoDB _id of the selected property
  //   isStaff      — hint from parent prop (backend uses JWT role as source of truth)
  const handleSubmit = async (pin) => {
    if (loading) return;

    // Block submission while account is locked
    if (lockedUntil || permanentlyLocked) return;

    if (!email.trim()) {
      showMsg('Please enter your email address.');
      triggerShake();
      clearDigits();
      return;
    }

    hideMsg();
    setLoading(true);

    try {
      const token = auth.getToken();
      const res = await fetch(`${API_BASE}/auth/verify-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key':    import.meta.env.VITE_API_KEY || '',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          email:      email.trim().toLowerCase(),
          pin,
          propertyId: selectedPropertyId,
          isStaff,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // ── Permanent lock ─────────────────────────────────────────
        if (data.permanentlyLocked) {
          setPermanentlyLocked(true);
          showMsg(data.error || 'Your account has been permanently locked. Please contact your administrator.');
          clearDigits();
          return;
        }

        // ── Temporary lock ─────────────────────────────────────────
        if (res.status === 423 && data.lockedUntil) {
          const until = new Date(data.lockedUntil);
          setLockedUntil(until);
          showMsg(data.error || 'Too many incorrect PIN attempts. Please wait before trying again.');
          clearDigits();
          return;
        }

        // ── Regular wrong PIN or other error ──────────────────────
        showMsg(data.error || 'Incorrect PIN. Please try again.');
        triggerShake();
        clearDigits();
        return;
      }

      // ── Success — persist the new session then navigate ──────────
      // The verify-pin endpoint returns a fresh accessToken scoped to the
      // logged-in user (staff / team_leader / client).  We MUST store it
      // here; otherwise the dashboard keeps using the old client token that
      // was already in sessionStorage, so req.user on the backend is always
      // the client account regardless of who actually entered the PIN.
      if (data.accessToken) {
        auth.setToken(data.accessToken);
      }
      if (data.user) {
        auth.setUser(data.user);
        // FIX: Use safeStorage instead of localStorage directly — localStorage
        // throws a SecurityError on go.hostops.online, safeStorage catches it
        // and falls back to an in-memory Map so the write always succeeds.
        safeStorage.setItem('hp_user', JSON.stringify(data.user));
      }

      // Persist the selected property so the dashboard loads the right one.
      // FIX: Use safeStorage instead of sessionStorage.
      // sessionStorage is cleared on cross-origin redirects, so DashboardContext
      // always read null on /dashboard and /inbox, set showPropertySelector:true,
      // and triggered the ERR_TOO_MANY_REDIRECTS loop on every page refresh.
      if (selectedPropertyId) {
        safeStorage.setItem('hp_selected_property_id', String(selectedPropertyId));
      }

      showMsg('Access granted. Redirecting…', 'success');
      setTimeout(() => navigate('/dashboard', { replace: true }), 800);
    } catch {
      showMsg('Something went wrong. Please try again.');
      triggerShake();
      clearDigits();
    } finally {
      setLoading(false);
    }
  };

  // ── Submit recovery request ──────────────────────────────────────
  const handleRecoverySubmit = async () => {
    if (!recoveryReason.trim() || recoveryReason.trim().length < 10) return;
    if (!email.trim()) {
      setShowRecoveryModal(false);
      showMsg('Please enter your email address first.');
      return;
    }

    setRecoveryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/recovery-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key':    import.meta.env.VITE_API_KEY || '',
        },
        body: JSON.stringify({
          email:  email.trim().toLowerCase(),
          reason: recoveryReason.trim(),
        }),
      });

      // We always show success to prevent email enumeration
      setRecoverySubmitted(true);
    } catch {
      setRecoverySubmitted(true); // still show success UI on network error
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleCloseRecovery = () => {
    setShowRecoveryModal(false);
    setRecoveryReason('');
    setRecoverySubmitted(false);
  };

  const filled    = digits.filter(Boolean).length;
  const allFilled = filled === PIN_LENGTH;
  const isLocked  = permanentlyLocked || !!lockedUntil;

  // ── Permanently locked screen ────────────────────────────────────
  if (permanentlyLocked) {
    return (
      <>
        <h1 className="lp-h1">Account Locked</h1>
        <div
          style={{
            textAlign:    'center',
            padding:      '32px 16px',
            display:      'flex',
            flexDirection:'column',
            alignItems:   'center',
            gap:          '16px',
          }}
        >
          {/* Lock icon */}
          <div
            style={{
              width:        '64px',
              height:       '64px',
              borderRadius: '50%',
              background:   '#fef2f2',
              border:       '2px solid #fecaca',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              fontSize:     '28px',
            }}
          >
            🔒
          </div>
          <p style={{ color: '#dc2626', fontWeight: '600', margin: 0, fontSize: '15px' }}>
            Your account has been permanently locked due to too many incorrect PIN attempts.
          </p>
          <p style={{ color: '#6b7280', margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
            Please contact your {isStaff ? 'manager' : 'administrator'} to restore access.
          </p>
        </div>

        {/* ── Recover Account button (permanently locked) ── */}
        <button
          type="button"
          className="lp-btn"
          onClick={() => setShowRecoveryModal(true)}
          style={{ width: '100%', marginBottom: '8px' }}
        >
          Request Account Recovery
        </button>

        <button
          type="button"
          className="lp-link"
          onClick={onBack}
          style={{ marginTop: '4px' }}
        >
          ← Back
        </button>

        {/* ── Recovery Modal ── */}
        <RecoveryModal
          show={showRecoveryModal}
          email={email}
          reason={recoveryReason}
          onReasonChange={setRecoveryReason}
          onSubmit={handleRecoverySubmit}
          onClose={handleCloseRecovery}
          loading={recoveryLoading}
          submitted={recoverySubmitted}
        />
      </>
    );
  }

  return (
    <>
      {/* ── Header ── */}
      <h1 className="lp-h1">Enter PIN</h1>
      <p className="lp-sub">
        {firstName ? `Hi ${firstName}! ` : ''}
        Enter your email and {PIN_LENGTH}-digit PIN to continue.
      </p>

      {/* ── Email field ── */}
      <div className="lp-field" style={{ marginBottom: '20px' }}>
        <label className="lp-label">Email</label>
        <input
          className="lp-input"
          type="email"
          autoComplete="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading || isLocked}
        />
      </div>

      {/* ── Temporary lock banner ─────────────────────────────────── */}
      {lockedUntil && (
        <div
          style={{
            background:   '#fff7ed',
            border:       '1.5px solid #fed7aa',
            borderRadius: '12px',
            padding:      '14px 16px',
            marginBottom: '20px',
            display:      'flex',
            alignItems:   'center',
            gap:          '12px',
          }}
        >
          <span style={{ fontSize: '22px' }}>⏳</span>
          <div>
            <p style={{ margin: 0, fontWeight: '600', color: '#c2410c', fontSize: '14px' }}>
              Account temporarily locked
            </p>
            <p style={{ margin: '2px 0 0', color: '#9a3412', fontSize: '13px' }}>
              Try again in{' '}
              <span style={{ fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>
                {formatCountdown(lockSecondsLeft)}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* ── PIN digit inputs ── */}
      <div
        style={{
          display:         'flex',
          gap:             '10px',
          justifyContent:  'center',
          margin:          '0 0 24px',
          animation:       shake ? 'pin-shake 0.5s ease' : 'none',
          opacity:         isLocked ? 0.4 : 1,
          pointerEvents:   isLocked ? 'none' : 'auto',
        }}
        onPaste={handlePaste}
      >
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={loading || isLocked}
            style={{
              width:          '46px',
              height:         '54px',
              borderRadius:   '12px',
              border:         `2px solid ${digit ? '#26a676' : '#e3ede8'}`,
              background:     digit ? '#eaf8f1' : '#f8fbf9',
              fontSize:       '22px',
              fontWeight:     '700',
              textAlign:      'center',
              color:          '#0c1c14',
              outline:        'none',
              transition:     'border-color 0.15s ease, background 0.15s ease, transform 0.1s ease',
              transform:      digit ? 'scale(1.05)' : 'scale(1)',
              cursor:         (loading || isLocked) ? 'not-allowed' : 'text',
              opacity:        (loading || isLocked) ? 0.6 : 1,
            }}
            aria-label={`PIN digit ${i + 1}`}
          />
        ))}
      </div>

      {/* ── Progress dots ── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '24px' }}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            style={{
              width:        '6px',
              height:       '6px',
              borderRadius: '50%',
              background:   i < filled ? '#26a676' : '#e3ede8',
              transition:   'background 0.15s ease',
            }}
          />
        ))}
      </div>

      {/* ── Submit button (manual, for accessibility) ── */}
      <button
        className="lp-btn"
        onClick={() => allFilled && handleSubmit(digits.join(''))}
        disabled={!allFilled || loading || isLocked}
        style={{ width: '100%' }}
      >
        {loading ? 'Verifying…' : isLocked ? `Locked — wait ${formatCountdown(lockSecondsLeft)}` : 'Continue'}
      </button>

      <button
        type="button"
        className="lp-link"
        onClick={onBack}
        disabled={loading}
        style={{ marginTop: '12px' }}
      >
        ← Back
      </button>

      {/* ── Recover Account link — shown only when locked ── */}
      {isLocked && (
        <button
          type="button"
          className="lp-link"
          onClick={() => setShowRecoveryModal(true)}
          style={{ marginTop: '4px', color: '#c2410c' }}
        >
          Recover account
        </button>
      )}

      {/* ── Recovery Modal ── */}
      <RecoveryModal
        show={showRecoveryModal}
        email={email}
        reason={recoveryReason}
        onReasonChange={setRecoveryReason}
        onSubmit={handleRecoverySubmit}
        onClose={handleCloseRecovery}
        loading={recoveryLoading}
        submitted={recoverySubmitted}
      />

      {/* ── Shake + spin keyframes ── */}
      <style>{`
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-6px); }
          30%       { transform: translateX(6px); }
          45%       { transform: translateX(-5px); }
          60%       { transform: translateX(5px); }
          75%       { transform: translateX(-3px); }
          90%       { transform: translateX(3px); }
        }
      `}</style>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// RecoveryModal
//
// Overlay modal shown when user clicks "Recover account".
// One question only: reason for lockout.
// On submit → POST /auth/recovery-request.
//
// Props:
//   show           boolean
//   email          string   — pre-filled from the PIN email field
//   reason         string
//   onReasonChange fn
//   onSubmit       fn
//   onClose        fn
//   loading        boolean
//   submitted      boolean  — true after successful submission
// ─────────────────────────────────────────────────────────────────
function RecoveryModal({ show, email, reason, onReasonChange, onSubmit, onClose, loading, submitted }) {
  if (!show) return null;

  const minLength = 10;
  const canSubmit = reason.trim().length >= minLength && !loading;

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          background: 'rgba(0, 0, 0, 0.45)',
          zIndex:     1000,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding:    '16px',
          backdropFilter: 'blur(2px)',
        }}
      >
        {/* ── Modal card — stop propagation so clicks inside don't close ── */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background:   '#ffffff',
            borderRadius: '20px',
            padding:      '32px 28px 28px',
            width:        '100%',
            maxWidth:     '420px',
            boxShadow:    '0 20px 60px rgba(0,0,0,0.18)',
            position:     'relative',
            animation:    'recovery-in 0.22s ease',
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position:   'absolute',
              top:        '16px',
              right:      '16px',
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              fontSize:   '20px',
              color:      '#9ab8a9',
              lineHeight: 1,
              padding:    '4px',
            }}
            aria-label="Close"
          >
            ✕
          </button>

          {submitted ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width:          '56px',
                  height:         '56px',
                  borderRadius:   '50%',
                  background:     '#eaf8f1',
                  border:         '2px solid #26a676',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontSize:       '24px',
                  margin:         '0 auto 16px',
                }}
              >
                ✓
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0c1c14', margin: '0 0 10px' }}>
                Request Submitted
              </h2>
              <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px' }}>
                Your account recovery request has been sent. An administrator will review it and contact you shortly.
              </p>
              <button
                type="button"
                className="lp-btn"
                onClick={onClose}
                style={{ width: '100%' }}
              >
                Close
              </button>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              {/* Icon */}
              <div
                style={{
                  width:          '48px',
                  height:         '48px',
                  borderRadius:   '50%',
                  background:     '#fff7ed',
                  border:         '2px solid #fed7aa',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontSize:       '22px',
                  marginBottom:   '16px',
                }}
              >
                🔑
              </div>

              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0c1c14', margin: '0 0 6px' }}>
                Recover Account
              </h2>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 20px', lineHeight: '1.5' }}>
                Tell us why your account was locked. Your request will be reviewed by an administrator.
              </p>

              {/* Email display (read-only) */}
              {email && (
                <div
                  style={{
                    background:   '#f8fbf9',
                    border:       '1.5px solid #e3ede8',
                    borderRadius: '10px',
                    padding:      '10px 14px',
                    marginBottom: '16px',
                    fontSize:     '13px',
                    color:        '#3a5248',
                  }}
                >
                  <span style={{ color: '#9ab8a9', fontSize: '12px', display: 'block', marginBottom: '2px' }}>
                    Account email
                  </span>
                  <strong>{email}</strong>
                </div>
              )}

              {/* Reason textarea */}
              <div style={{ marginBottom: '20px' }}>
                <label
                  className="lp-label"
                  style={{ display: 'block', marginBottom: '6px' }}
                >
                  Why was your account locked?
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => onReasonChange(e.target.value)}
                  placeholder="e.g. I forgot my PIN after returning from a 2-week trip and entered it incorrectly multiple times."
                  rows={4}
                  maxLength={1000}
                  style={{
                    width:        '100%',
                    borderRadius: '12px',
                    border:       '1.5px solid #e3ede8',
                    padding:      '12px 14px',
                    fontSize:     '14px',
                    color:        '#0c1c14',
                    background:   '#f8fbf9',
                    outline:      'none',
                    resize:       'vertical',
                    fontFamily:   'inherit',
                    lineHeight:   '1.5',
                    boxSizing:    'border-box',
                    transition:   'border-color 0.15s ease',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#26a676'; }}
                  onBlur={(e)  => { e.target.style.borderColor = '#e3ede8'; }}
                  disabled={loading}
                />
                <div
                  style={{
                    display:        'flex',
                    justifyContent: 'space-between',
                    marginTop:      '4px',
                    fontSize:       '12px',
                    color:          '#9ab8a9',
                  }}
                >
                  <span>
                    {reason.trim().length < minLength
                      ? `At least ${minLength} characters required`
                      : ''}
                  </span>
                  <span>{reason.length}/1000</span>
                </div>
              </div>

              {/* Action buttons */}
              <button
                type="button"
                className="lp-btn"
                onClick={onSubmit}
                disabled={!canSubmit}
                style={{ width: '100%', marginBottom: '10px' }}
              >
                {loading ? 'Submitting…' : 'Submit Recovery Request'}
              </button>
              <button
                type="button"
                className="lp-link"
                onClick={onClose}
                disabled={loading}
                style={{ width: '100%' }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes recovery-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </>
  );
}