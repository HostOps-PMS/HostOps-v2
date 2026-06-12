import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import safeStorage from '../../safeStorage';
import RecoveryModal from './RecoveryModal';

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

const DISABLED_TIPS = [
  "Your account took an extended vacation — without filing the paperwork first.",
  "Error 403: Not all accounts are created equal. Yours has been temporarily demoted.",
  "Your account called in sick and never came back. A true legend.",
  "Plot twist: the system knows something you don't. Specifically, that you've been disabled.",
  "Your account has entered its 'finding itself' phase. Please contact your administrator.",
  "Someone pressed the big red button. Your account is now officially out of office.",
  "Account status: disabled. Vibe status: unaffected (probably).",
  "This isn't you, it's them. Well — actually it is them. Contact your admin to find out.",
  "Your account is on a mandatory digital detox. Against its will.",
  "Access revoked. In case you were wondering — yes, someone definitely noticed.",
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

  // ── Disabled account state ────────────────────────────────────────
  const [isDisabled, setIsDisabled]             = useState(false);
  const [disabledTipIndex, setDisabledTipIndex] = useState(() => Math.floor(Math.random() * DISABLED_TIPS.length));

  // ── Recovery modal state ──────────────────────────────────────────
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryReason, setRecoveryReason]       = useState('');
  const [recoveryLoading, setRecoveryLoading]     = useState(false);
  const [recoverySubmitted, setRecoverySubmitted] = useState(false);

  // ── One-shot pending flags — persist in sessionStorage so re-opening
  //    the page doesn't reset the "already submitted" state.
  const [hasPendingPinRecovery, setHasPendingPinRecovery] = useState(() => {
    const e = (userData?.email || '').trim().toLowerCase();
    return e ? !!sessionStorage.getItem(`hp_pending_req_${e}_pin`) : false;
  });
  const [hasPendingDisabledAppeal, setHasPendingDisabledAppeal] = useState(() => {
    const e = (userData?.email || '').trim().toLowerCase();
    return e ? !!sessionStorage.getItem(`hp_pending_req_${e}_disabled`) : false;
  });

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
        // ── Disabled account ───────────────────────────────────────
        if (data.accountDisabled) {
          setIsDisabled(true);
          setDisabledTipIndex(Math.floor(Math.random() * DISABLED_TIPS.length));
          hideMsg();
          clearDigits();
          return;
        }

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
          email:       email.trim().toLowerCase(),
          reason:      recoveryReason.trim(),
          requestType: isDisabled ? 'account_disabled' : 'pin_recovery',
        }),
      });

      // We always show success to prevent email enumeration
      setRecoverySubmitted(true);
      const key = `hp_pending_req_${email.trim().toLowerCase()}_${isDisabled ? 'disabled' : 'pin'}`;
      sessionStorage.setItem(key, '1');
      if (isDisabled) setHasPendingDisabledAppeal(true);
      else            setHasPendingPinRecovery(true);
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

  // ── Disabled account screen ──────────────────────────────────────
  if (isDisabled) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '420px' }}>
        <h1 className="lp-h1">Account Disabled</h1>

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
          {/* Ripple rings + ban icon */}
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
                <circle cx="12" cy="12" r="9" fill="#ffe4e6" stroke="#b91c1c" strokeWidth="1.7"/>
                <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" stroke="#b91c1c" strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          <p style={{ color: '#b91c1c', fontWeight: '600', margin: 0, fontSize: '13px', lineHeight: '1.5', maxWidth: '270px' }}>
            This account has been disabled by an administrator.
          </p>

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
              Account Tip
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#78350f', lineHeight: '1.65' }}>
              {DISABLED_TIPS[disabledTipIndex]}
            </p>
          </div>
        </div>

        <div>
          {hasPendingDisabledAppeal ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
              padding: '10px 16px', borderRadius: 10,
              background: '#f0fdf4', border: '1px solid #6ee7b7',
              fontSize: '13px', fontWeight: 600, color: '#059669',
              marginBottom: '8px',
            }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              Appeal submitted — pending admin review
            </div>
          ) : (
            <button
              type="button"
              className="lp-btn"
              onClick={() => setShowRecoveryModal(true)}
              style={{ width: '100%', marginBottom: '8px' }}
            >
              Contact Administrator
            </button>
          )}
          <button
            type="button"
            className="lp-link"
            onClick={onBack}
            style={{ marginTop: '4px' }}
          >
            ← Back
          </button>
        </div>

        <RecoveryModal
          show={showRecoveryModal}
          email={email}
          reason={recoveryReason}
          onReasonChange={setRecoveryReason}
          onSubmit={handleRecoverySubmit}
          onClose={handleCloseRecovery}
          loading={recoveryLoading}
          submitted={recoverySubmitted}
          title="Contact Administrator"
          description="Explain why your account should be re-enabled. An administrator will review your appeal."
          label="Why should your account be re-enabled?"
          placeholder="e.g. I believe my account was disabled by mistake. I am still an active employee and need access to continue my work."
          submitLabel="Submit Appeal"
        />

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
          {hasPendingPinRecovery ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
              padding: '10px 16px', borderRadius: 10,
              background: '#f0fdf4', border: '1px solid #6ee7b7',
              fontSize: '13px', fontWeight: 600, color: '#059669',
              marginBottom: '8px',
            }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              Request submitted — pending admin review
            </div>
          ) : (
            <button
              type="button"
              className="lp-btn"
              onClick={() => setShowRecoveryModal(true)}
              style={{ width: '100%', marginBottom: '8px' }}
            >
              Request Account Recovery
            </button>
          )}

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

