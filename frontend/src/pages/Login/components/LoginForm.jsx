import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { loginUser } from '../services/authservice';
import { useAuthSubmit } from '../hooks/useAuth';
import { useAuth } from '../../AuthContext';
import RecoveryModal from './RecoveryModal';

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

export default function LoginForm({ showMsg, hideMsg, onForgot, onRequiresOtp, onClientAccountLogin, onAuthSuccess }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [disabledTipIndex] = useState(() => Math.floor(Math.random() * DISABLED_TIPS.length));
  const [showAppealModal, setShowAppealModal]   = useState(false);
  const [appealReason, setAppealReason]         = useState('');
  const [appealLoading, setAppealLoading]       = useState(false);
  const [appealSubmitted, setAppealSubmitted]   = useState(false);
  const [appealError, setAppealError]           = useState('');
  const [hasPendingAppeal, setHasPendingAppeal] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // When the disabled screen appears, check if this email already has a pending appeal.
  React.useEffect(() => {
    if (isDisabled && email.trim()) {
      const key = `hp_pending_req_${email.trim().toLowerCase()}_disabled`;
      setHasPendingAppeal(!!sessionStorage.getItem(key));
    }
  }, [isDisabled, email]);

  const handleAppealSubmit = async () => {
    if (!appealReason.trim() || appealReason.trim().length < 10) return;
    if (!email.trim()) return;
    setAppealLoading(true);
    setAppealError('');
    try {
      const res = await fetch(`${API_BASE}/auth/recovery-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_KEY || '',
        },
        body: JSON.stringify({
          email:       email.trim().toLowerCase(),
          reason:      appealReason.trim(),
          requestType: 'account_disabled',
        }),
      });
      // The server answers 201 even for unknown emails (no enumeration), so a
      // non-OK status is a real failure — don't pretend the appeal was sent.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAppealError(data.error || 'Could not submit your appeal. Please try again.');
        return;
      }
      const key = `hp_pending_req_${email.trim().toLowerCase()}_disabled`;
      sessionStorage.setItem(key, '1');
      setHasPendingAppeal(true);
      setAppealSubmitted(true);
    } catch {
      setAppealError('Network error. Please check your connection and try again.');
    } finally {
      setAppealLoading(false);
    }
  };

  const { submit, loading } = useAuthSubmit(loginUser, {
    onSuccess: (data) => {
      if (data.requiresOtp) {
        onRequiresOtp(email, rememberMe, data.totpEnabled || false, data.mfaToken);
        return;
      }

      // ── Client Account login ───────────────────────────────────────
      // Client accounts skip OTP and DomainLoginForm entirely.
      // Token is stored here; PropertySelectForm will use it to fetch
      // the parent client's properties from /api/properties.
      if (data.isClientAccount) {
        auth.setToken(data.accessToken);
        if (data.sk) auth.setSessionKey(data.sk);
        auth.setUser({ ...data.clientAccount, role: 'clientAccount', isClientAccount: true });

        if (data.mustChangePassword) {
          sessionStorage.setItem('hp_must_change_password', 'true');
        } else {
          sessionStorage.removeItem('hp_must_change_password');
        }

        if (data.mustChangePin) {
          sessionStorage.setItem('hp_must_change_pin', 'true');
        } else {
          sessionStorage.removeItem('hp_must_change_pin');
        }

        // ✅ Client accounts now redirect to the admin dashboard (same as
        // admin/team_leader). Token is passed via URL params since sessionStorage
        // is port-scoped. The AuthorizationModal OTP gate on the admin app will
        // intercept and require verification before granting access.
        showMsg(`Welcome, ${data.clientAccount.firstName}! Redirecting...`, 'success');
        setTimeout(() => {
          const dashboardBase = import.meta.env.VITE_DASHBOARD_URL || 'https://core.hostops.online';
          const params = new URLSearchParams({
            _t: data.accessToken,
            _u: JSON.stringify({ ...data.clientAccount, role: 'clientAccount', isClientAccount: true }),
          });
          window.location.href = `${dashboardBase}/admin#${params.toString()}`;
        }, 800);
        return;
      }

      auth.setToken(data.accessToken);
      if (data.sk) auth.setSessionKey(data.sk);

      // Staff login returns data.staff (not data.user).
      // Normalise so auth context and downstream handlers always have data.user.
      if (data.isStaff && data.staff && !data.user) {
        data = { ...data, user: { ...data.staff, role: 'staff', isStaff: true } };
      }

      auth.setUser(data.user);

      // If the account was admin-created with a temporary password,
      // flag it so the dashboard shows the first-login password-change modal.
      if (data.user?.mustChangePassword) {
        sessionStorage.setItem('hp_must_change_password', 'true');
      } else {
        sessionStorage.removeItem('hp_must_change_password');
      }

      if (data.user?.mustChangePin) {
        sessionStorage.setItem('hp_must_change_pin', 'true');
      } else {
        sessionStorage.removeItem('hp_must_change_pin');
      }

      onAuthSuccess({ ...data, rememberMe });
    },
    onError: (msg) => {
      if (msg && msg.toLowerCase().includes('been disabled')) {
        setIsDisabled(true);
        hideMsg();
      } else {
        showMsg(msg);
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    hideMsg();
    let deviceId = localStorage.getItem('hp_device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      localStorage.setItem('hp_device_id', deviceId);
    }
    submit({ email, password, deviceId });
  };

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
                animation:    `lf-ripple-slow 3.6s ease-out ${delay}s infinite`,
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
              Contact your administrator to restore access.
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
            animation:    'lf-tip-fade-up 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
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
          {hasPendingAppeal ? (
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
              onClick={() => setShowAppealModal(true)}
              style={{ width: '100%', marginBottom: '8px' }}
            >
              Contact Administrator
            </button>
          )}
          <button
            type="button"
            className="lp-link"
            onClick={() => { setIsDisabled(false); setEmail(''); setPassword(''); }}
            style={{ marginTop: '4px' }}
          >
            ← Try a different account
          </button>
        </div>

        <RecoveryModal
          show={showAppealModal}
          email={email}
          reason={appealReason}
          onReasonChange={setAppealReason}
          onSubmit={handleAppealSubmit}
          onClose={() => { if (!appealLoading) { setShowAppealModal(false); setAppealError(''); if (appealSubmitted) setAppealReason(''); } }}
          loading={appealLoading}
          submitted={appealSubmitted}
          error={appealError}
          title="Contact Administrator"
          description="Explain why your account should be re-enabled. An administrator will review your appeal."
          label="Why should your account be re-enabled?"
          placeholder="e.g. I believe my account was disabled by mistake. I am still an active employee and need access to continue my work."
          submitLabel="Submit Appeal"
        />

        <style>{`
          @keyframes lf-ripple-slow {
            0%   { transform: scale(1);    opacity: 0.55; }
            100% { transform: scale(2.05); opacity: 0;    }
          }
          @keyframes lf-tip-fade-up {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0);    }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <h1 className="lp-h1">Welcome back</h1>
      <p className="lp-sub">Sign in to view your live property dashboard.</p>

      <form onSubmit={handleSubmit} autoComplete="on">
        <div className="lp-field">
          <label className="lp-label">Email</label>
          <input
            className="lp-input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="lp-field">
          <label className="lp-label">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              className="lp-input"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: '42px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                cursor: 'pointer', padding: 0,
                color: '#9aa6a1', display: 'flex',
                alignItems: 'center',
              }}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* // ---Remember Me-------------- */}
        <div className="lp-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <input 
            type="checkbox" 
            id="rememberMe" 
            checked={rememberMe} 
            onChange={(e) => setRememberMe(e.target.checked)} 
            style={{ width: 'auto', marginBottom: '0' }}
          />
          <label htmlFor="rememberMe" className="lp-label" style={{ marginBottom: '0', cursor: 'pointer' }}>
            Remember Me
          </label>
        </div>
        {/* // ---Remember Me-------------- */}

        <button className="lp-btn" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <button type="button" className="lp-link" onClick={onForgot}>
          Forgot password?
        </button>
      </form>
    </>
  );
}