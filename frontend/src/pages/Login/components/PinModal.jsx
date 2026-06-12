import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import safeStorage from '../../safeStorage';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://hostpilot-smoobu.onrender.com';
const PIN_LENGTH = 6;

const PIN_TIPS = [
  "Try using a number that means something to you — like how many times you've done this.",
  "Your PIN is not 123456. We know, because literally everyone uses that. Please try harder.",
  "A password manager stores everything securely and has been patiently waiting for you to try it.",
  "If you can remember your WiFi password (all 32 characters of it), you can definitely handle 6 digits.",
  "A Post-it® note on your monitor isn't what security experts recommend. But here we are.",
  "Consider your anniversary date — if you can remember that, PINs should be child's play.",
  "Fun fact: Humans can hold up to 7 things in short-term memory. You only needed 6. We believe in you.",
  "The number of times you've locked yourself out is now a very memorable PIN candidate.",
  "Writing your PIN on your palm works great — until you wash your hands. (Please wash your hands.)",
  "Plot twist: You actually know your PIN. It's just playing hard to get. Try again soon.",
];

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

  const [email, setEmail] = useState(() => userData?.email || auth.getUser()?.email || '');
  const [digits, setDigits] = useState(Array(PIN_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [shake, setShake]   = useState(false);

  // ── Inline error — shown below PIN inputs, not in the top banner ──
  const [inlineError, setInlineError] = useState('');

  // ── Lockout state ─────────────────────────────────────────────────
  // lockedUntil: Date object — account is temporarily locked until this time
  // permanentlyLocked: boolean — account is permanently disabled
  // lockSecondsLeft: countdown in seconds for the temp lock timer
  const [lockedUntil, setLockedUntil]           = useState(null);
  const [permanentlyLocked, setPermanentlyLocked] = useState(false);
  const [lockSecondsLeft, setLockSecondsLeft]   = useState(0);
  const [tipIndex, setTipIndex]                 = useState(() => Math.floor(Math.random() * PIN_TIPS.length));

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
        setInlineError('');
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

  // Pick a fresh random tip each time a new lock starts
  useEffect(() => {
    if (lockedUntil) setTipIndex(Math.floor(Math.random() * PIN_TIPS.length));
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
      setInlineError('Please enter your email address.');
      triggerShake();
      clearDigits();
      return;
    }

    hideMsg();
    setInlineError('');
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
          hideMsg();
          clearDigits();
          return;
        }

        // ── Temporary lock ─────────────────────────────────────────
        if (res.status === 423 && data.lockedUntil) {
          const until = new Date(data.lockedUntil);
          setLockedUntil(until);
          setInlineError(data.error || 'Too many incorrect PIN attempts. Please wait before trying again.');
          clearDigits();
          return;
        }

        // ── Regular wrong PIN or other error ──────────────────────
        setInlineError(data.error || 'Incorrect PIN. Please try again.');
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
        const verifiedUser = {
          ...data.user,
          email: data.user.email || email.trim().toLowerCase(),
        };
        auth.setUser(verifiedUser);
        // FIX: Use safeStorage instead of localStorage directly — localStorage
        // throws a SecurityError on go.hostops.online, safeStorage catches it
        // and falls back to an in-memory Map so the write always succeeds.
        safeStorage.setItem('hp_user', JSON.stringify(verifiedUser));
        
        if (verifiedUser.mustChangePin) {
          sessionStorage.setItem('hp_must_change_pin', 'true');
        } else {
          sessionStorage.removeItem('hp_must_change_pin');
        }
      }

      // Persist the selected property so the dashboard loads the right one.
      // FIX: Use safeStorage instead of sessionStorage.
      // sessionStorage is cleared on cross-origin redirects, so DashboardContext
      // always read null on /dashboard and /inbox, set showPropertySelector:true,
      // and triggered the ERR_TOO_MANY_REDIRECTS loop on every page refresh.
      if (selectedPropertyId) {
        safeStorage.setItem('hp_selected_property_id', String(selectedPropertyId));
      }

      // ── Log the login action ──────────────────────────────────────────────
      // Activity logging is done here (after PIN verification) because
      // this is the final step where we know the exact account type:
      //   - staff       → isStaff=true, role resolved by backend from JWT
      //   - client      → isStaff=false, role=client
      //   - team_leader → isStaff=false, role=team_leader
      // Fire-and-forget — we don't block navigation on log failure.
      try {
        const logToken = data.accessToken || auth.getToken();
        fetch(`${API_BASE}/api/activity-log`, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key':    import.meta.env.VITE_API_KEY || '',
            Authorization:  `Bearer ${logToken}`,
          },
          body: JSON.stringify({
            action: 'login',
            meta:   {
              method:       'pin',
              propertyId:   selectedPropertyId || null,
              propertyName: safeStorage.getItem('hp_selected_property_name') || null,
              role:         data.user?.role || (isStaff ? 'staff' : 'client'),
            },
          }),
        }).catch(() => { /* ignore log errors silently */ });
      } catch {
        // Never block login flow on log failure
      }

      showMsg('Access granted. Redirecting…', 'success');
      setTimeout(() => navigate('/dashboard', { replace: true }), 800);
    } catch {
      setInlineError('Something went wrong. Please try again.');
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '420px' }}>

        {/* Heading — top */}
        <h1 className="lp-h1">Account Locked</h1>

        {/* Body — grows to fill space */}
        <div style={{
          flex:           1,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          textAlign:      'center',
          gap:            '16px',
          padding:        '8px 0',
        }}>
          {/* Ripple rings + lock icon */}
          <div style={{
            position:       'relative',
            width:          '180px',
            height:         '180px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
            overflow:       'hidden',
          }}>
            {[0, 1.2, 2.4].map((delay, i) => (
              <div key={i} style={{
                position:     'absolute',
                top:          '50%',
                left:         '50%',
                marginTop:    '-44px',
                marginLeft:   '-44px',
                width:        '88px',
                height:       '88px',
                borderRadius: '50%',
                border:       '1.5px solid rgba(185, 28, 28, 0.4)',
                animation:    `lock-ripple-slow 3.6s ease-out ${delay}s infinite`,
              }} />
            ))}
            <div style={{
              width:          '88px',
              height:         '88px',
              borderRadius:   '50%',
              background:     'linear-gradient(145deg, #fff1f2 0%, #ffe4e6 100%)',
              border:         '2px solid #fca5a5',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              position:       'relative',
              zIndex:         1,
              boxShadow:      '0 4px 18px rgba(185,28,28,0.18)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="11" width="14" height="10" rx="2" fill="#ffe4e6" stroke="#b91c1c" strokeWidth="1.7"/>
                <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#b91c1c" strokeWidth="1.7" strokeLinecap="round"/>
                <circle cx="12" cy="16" r="1.5" fill="#b91c1c"/>
              </svg>
            </div>
          </div>

          <p style={{ color: '#b91c1c', fontWeight: '600', margin: 0, fontSize: '13px', lineHeight: '1.5', maxWidth: '270px' }}>
            Account permanently locked due to too many incorrect PIN attempts.
          </p>

          {/* Contact note */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          '8px',
            background:   '#fff1f2',
            border:       '1px solid #fecdd3',
            borderRadius: '10px',
            padding:      '9px 13px',
            width:        '100%',
            boxSizing:    'border-box',
            textAlign:    'left',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="9" stroke="#dc2626" strokeWidth="1.7"/>
              <path d="M12 11v5" stroke="#dc2626" strokeWidth="1.7" strokeLinecap="round"/>
              <circle cx="12" cy="8" r="0.9" fill="#dc2626"/>
            </svg>
            <span style={{ color: '#991b1b', fontSize: '12px', lineHeight: '1.5' }}>
              Contact your {isStaff ? 'manager' : 'administrator'} to restore access.
            </span>
          </div>

          {/* Humorous tip card */}
          <div style={{
            background:   '#fffbeb',
            border:       '1px solid #fde68a',
            borderLeft:   '3px solid #f59e0b',
            borderRadius: '10px',
            padding:      '10px 14px',
            width:        '100%',
            boxSizing:    'border-box',
            animation:    'tip-fade-up 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
            textAlign:    'left',
          }}>
            <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: '700', color: '#b45309', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              PIN Tip
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#78350f', lineHeight: '1.65' }}>
              {PIN_TIPS[tipIndex]}
            </p>
          </div>
        </div>

        {/* Buttons — bottom */}
        <div>
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
        </div>

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

        {/* ── Keyframes for permanent lock screen ── */}
        <style>{`
          @keyframes lock-ripple-slow {
            0%   { transform: scale(1);    opacity: 0.55; }
            100% { transform: scale(2.05); opacity: 0;    }
          }
          @keyframes tip-fade-up {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0);    }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '420px' }}>
      {lockedUntil ? (
        /* ── Temporary locked state — inputs hidden, animation + tip shown ── */
        <>
          <h1 className="lp-h1" style={{ marginBottom: '2px' }}>Locked Out</h1>
          <p className="lp-sub" style={{ marginBottom: 0 }}>Too many incorrect PIN attempts.</p>

          <div style={{
            flex:           1,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            '18px',
            padding:        '12px 0 8px',
          }}>
            {/* Ripple rings + lock icon */}
            <div style={{
              position:       'relative',
              width:          '180px',
              height:         '180px',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
              overflow:       'hidden',
            }}>
              {[0, 0.9, 1.8].map((delay, i) => (
                <div key={i} style={{
                  position:     'absolute',
                  top:          '50%',
                  left:         '50%',
                  marginTop:    '-44px',
                  marginLeft:   '-44px',
                  width:        '88px',
                  height:       '88px',
                  borderRadius: '50%',
                  border:       '1.5px solid rgba(220, 38, 38, 0.45)',
                  animation:    `lock-ripple 2.7s ease-out ${delay}s infinite`,
                }} />
              ))}
              <div style={{
                width:          '88px',
                height:         '88px',
                borderRadius:   '50%',
                background:     'linear-gradient(145deg, #fff5f5 0%, #fee2e2 100%)',
                border:         '2px solid #fca5a5',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                position:       'relative',
                zIndex:         1,
                boxShadow:      '0 4px 18px rgba(220,38,38,0.14)',
              }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="11" width="14" height="10" rx="2" fill="#fee2e2" stroke="#dc2626" strokeWidth="1.7"/>
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#dc2626" strokeWidth="1.7" strokeLinecap="round"/>
                  <circle cx="12" cy="16" r="1.5" fill="#dc2626"/>
                </svg>
              </div>
            </div>

            {/* Tip card */}
            <div style={{
              background:   '#fffbeb',
              border:       '1px solid #fde68a',
              borderLeft:   '3px solid #f59e0b',
              borderRadius: '10px',
              padding:      '10px 14px',
              width:        '100%',
              boxSizing:    'border-box',
              animation:    'tip-fade-up 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
              textAlign:    'left',
            }}>
              <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: '700', color: '#b45309', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                PIN Tip
              </p>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#78350f', lineHeight: '1.65' }}>
                {PIN_TIPS[tipIndex]}
              </p>
            </div>
          </div>
        </>
      ) : (
        /* ── Normal state — email + PIN inputs ── */
        <>
          <h1 className="lp-h1">Enter PIN</h1>
          <p className="lp-sub" style={{ marginBottom: '24px' }}>
            {firstName ? `Hi ${firstName}! ` : ''}
            Enter your email and {PIN_LENGTH}-digit PIN to continue.
          </p>

          {/* ── Email field ── */}
          <div className="lp-field" style={{ marginBottom: '28px' }}>
            <label className="lp-label">Email</label>
            <input
              className="lp-input"
              type="email"
              autoComplete="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* ── PIN digit inputs ── */}
          <div
            style={{
              display:        'flex',
              gap:            '10px',
              justifyContent: 'center',
              marginBottom:   '14px',
              animation:      shake ? 'pin-shake 0.5s ease' : 'none',
              width:          '100%',
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
                disabled={loading}
                style={{
                  width:        '46px',
                  height:       '54px',
                  borderRadius: '12px',
                  border:       `2px solid ${digit ? '#26a676' : '#e3ede8'}`,
                  background:   digit ? '#eaf8f1' : '#f8fbf9',
                  fontSize:     '22px',
                  fontWeight:   '700',
                  textAlign:    'center',
                  color:        '#0c1c14',
                  outline:      'none',
                  transition:   'border-color 0.15s ease, background 0.15s ease, transform 0.12s ease',
                  transform:    digit ? 'scale(1.04)' : 'scale(1)',
                  cursor:       loading ? 'not-allowed' : 'text',
                  fontFamily:   'inherit',
                }}
                aria-label={`PIN digit ${i + 1}`}
              />
            ))}
          </div>

          {/* ── Progress dots ── */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '20px' }}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                style={{
                  width:        i < filled ? '16px' : '6px',
                  height:       '6px',
                  borderRadius: '3px',
                  background:   i < filled ? '#26a676' : '#e3ede8',
                  transition:   'all 0.2s ease',
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Buttons + error — pushed to bottom ── */}
      <div style={{ marginTop: 'auto' }}>
        <button
          className="lp-btn"
          onClick={() => allFilled && handleSubmit(digits.join(''))}
          disabled={!allFilled || loading || isLocked}
          style={{
            width: '100%',
            ...(isLocked ? {
              background: '#ea580c',
              color:      '#fff',
              border:     '1.5px solid #ea580c',
              opacity:    1,
              cursor:     'not-allowed',
            } : {}),
          }}
        >
          {loading
            ? 'Verifying…'
            : isLocked
            ? `Locked — wait ${formatCountdown(lockSecondsLeft)}`
            : 'Continue'}
        </button>

        {/* ── Inline error — hidden when locked (animation conveys the state) ── */}
        {inlineError && !lockedUntil && (
          <div style={{
            background:   '#fff0ee',
            border:       '1px solid #ffd5ce',
            borderRadius: '10px',
            padding:      '10px 14px',
            marginTop:    '12px',
            fontSize:     '13px',
            color:        '#c13515',
            lineHeight:   '1.5',
          }}>
            {inlineError}
          </div>
        )}

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
      </div>

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

      {/* ── Keyframes ── */}
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
        @keyframes lock-ripple {
          0%   { transform: scale(1);    opacity: 0.6; }
          100% { transform: scale(2.05); opacity: 0;   }
        }
        @keyframes tip-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          {submitted ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width:          '52px',
                  height:         '52px',
                  borderRadius:   '50%',
                  background:     '#eaf8f1',
                  border:         '1.5px solid #26a676',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  margin:         '0 auto 16px',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 13l4 4L19 7" stroke="#26a676" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
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