import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';

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
        // Also mirror role into sessionStorage so any component that reads
        // hp_user directly (e.g. index.jsx currentUser block) gets the right shape.
        sessionStorage.setItem('hp_user', JSON.stringify(data.user));
      }

      // Persist the selected property so the dashboard loads the right one.
      if (selectedPropertyId) {
        sessionStorage.setItem('hp_selected_property_id', selectedPropertyId);
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
        <button
          type="button"
          className="lp-link"
          onClick={onBack}
          style={{ marginTop: '12px' }}
        >
          ← Back
        </button>
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