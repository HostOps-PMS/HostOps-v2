import React, { useState, useRef, useEffect } from 'react';
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
// Role detection is done here via auth.getUser() so the correct identity
// is always used regardless of how the parent passes props.
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

  const [digits, setDigits] = useState(Array(PIN_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [shake, setShake]   = useState(false);
  const inputRefs = useRef([]);

  // ── Resolve the actual logged-in user from session storage ──────
  // This is the source of truth for role detection.
  // - Staff login  → stored user has role: 'staff' and isStaff: true
  // - Team leader  → stored user has role: 'team_leader'
  // - Client       → stored user has role: 'client'
  // We never trust only the `isStaff` prop from the parent because
  // staff login returns `data.staff` (not `data.user`) and some parent
  // paths may not correctly forward the isStaff flag.
  const storedUser   = auth.getUser();
  const resolvedRole = storedUser?.role || 'client';
  const isStaffUser  = resolvedRole === 'staff' || storedUser?.isStaff === true || isStaff;

  // Greeting name: prefer storedUser over prop so it's always accurate
  const firstName = storedUser?.firstName || userData?.firstName || '';

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // ── Auto-submit when all digits filled ──────────────────────────
  useEffect(() => {
    if (digits.every((d) => d !== '')) {
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
  //   pin          — the entered PIN
  //   propertyId   — MongoDB _id of the selected property
  //   isStaff      — derived from the stored session user, NOT from the prop.
  //                  The backend ignores this field (it uses req.isStaff from
  //                  the JWT) but we keep it for forward-compatibility.
  //
  // Role-specific behavior (enforced on backend, mirrored here for UX):
  //   staff       → backend checks pin vs Staff.pin AND propertyId vs staff.propertyIds
  //   team_leader → backend checks pin vs serverId client's User.pin
  //   client      → backend checks pin vs own User.pin
  const handleSubmit = async (pin) => {
    if (loading) return;
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
          pin,
          propertyId: selectedPropertyId,
          // Derived from stored session — never from prop alone
          isStaff: isStaffUser,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Surface a role-aware error message so the user knows what went wrong
        let errMsg = data.error || 'Incorrect PIN. Please try again.';

        // For staff: backend returns a specific message when the property is
        // not in their assigned list — surface it directly.
        if (isStaffUser && data.error?.toLowerCase().includes('access')) {
          errMsg = data.error;
        }

        showMsg(errMsg);
        triggerShake();
        clearDigits();
        return;
      }

      // ── Success — navigate to dashboard ───────────────────────────
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

  // ── Role-aware subtitle ──────────────────────────────────────────
  const subtitle = (() => {
    if (isStaffUser)              return `Enter your staff PIN to access this property.`;
    if (resolvedRole === 'team_leader') return `Enter the property PIN to continue.`;
    return `Enter your ${PIN_LENGTH}-digit PIN to continue.`;
  })();

  return (
    <>
      {/* ── Header ── */}
      <h1 className="lp-h1">Enter PIN</h1>
      <p className="lp-sub">
        {firstName ? `Hi ${firstName}! ` : ''}
        {subtitle}
      </p>

      {/* ── PIN digit inputs ── */}
      <div
        style={{
          display:         'flex',
          gap:             '10px',
          justifyContent:  'center',
          margin:          '28px 0 24px',
          animation:       shake ? 'pin-shake 0.5s ease' : 'none',
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
              cursor:         loading ? 'not-allowed' : 'text',
              opacity:        loading ? 0.6 : 1,
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
        disabled={!allFilled || loading}
        style={{ width: '100%' }}
      >
        {loading ? 'Verifying…' : 'Continue'}
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