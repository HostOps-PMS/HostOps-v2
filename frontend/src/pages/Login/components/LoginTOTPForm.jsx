import React, { useState, useEffect } from 'react';
import { verifyTotpLogin } from '../services/authservice';
import { useAuthSubmit } from '../hooks/useAuth';
import { useAuth } from '../../AuthContext';
import OTPInput from './OTPInput';
import LockoutTimer from './LockoutTimer';

export default function LoginTOTPForm({ email, mfaToken, showMsg, hideMsg, onBack, onAuthSuccess, backupMode = false }) {
  const auth = useAuth();
  const [useBackup, setUseBackup] = useState(backupMode);
  const [backupCode, setBackupCode] = useState('');
  const [lockoutTimer, setLockoutTimer] = useState(() => {
    const expiry = localStorage.getItem('hp_otp_lockout');
    if (expiry) {
      const remaining = Math.ceil((parseInt(expiry, 10) - Date.now()) / 1000);
      if (remaining > 0) return remaining;
      localStorage.removeItem('hp_otp_lockout');
    }
    return 0;
  });

  useEffect(() => {
    if (lockoutTimer <= 0) {
      localStorage.removeItem('hp_otp_lockout');
      return;
    }
    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev <= 1) {
          localStorage.removeItem('hp_otp_lockout');
          hideMsg();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const { submit, loading } = useAuthSubmit(verifyTotpLogin, {
    onSuccess: (data) => {
      auth.setToken(data.accessToken);
      if (data.sk) auth.setSessionKey(data.sk);
      auth.setUser(data.user);

      if (data.user.mustChangePassword) {
        sessionStorage.setItem('hp_must_change_password', 'true');
      } else {
        sessionStorage.removeItem('hp_must_change_password');
      }

      if (data.user.mustChangePin) {
        sessionStorage.setItem('hp_must_change_pin', 'true');
      } else {
        sessionStorage.removeItem('hp_must_change_pin');
      }

      onAuthSuccess(data);
    },
    onError: (msg, err) => {
      if (err?.status === 429) {
        const remaining = err.retryAfter || 90;
        setLockoutTimer(remaining);
        localStorage.setItem('hp_otp_lockout', Date.now() + remaining * 1000);
        showMsg('Too many attempts. Please wait.');
      } else {
        showMsg(msg);
      }
    },
  });

  const handleCodeComplete = (code) => {
    hideMsg();
    submit({ email, token: code, mfaToken });
  };

  const handleBackupSubmit = (e) => {
    e.preventDefault();
    if (backupCode.replace(/-/g, '').length < 8 || loading) return;
    hideMsg();
    submit({ email, token: backupCode.replace(/-/g, ''), mfaToken });
  };

  return (
    <>
      <h1 className="lp-h1">{useBackup ? 'Backup Code' : 'Two-Factor Authentication'}</h1>
      <p className="lp-sub">
        {useBackup
          ? <>Enter one of your <strong>8-character backup codes</strong>.</>
          : <>Enter the 6-digit code from your <strong>authenticator app</strong>.</>
        }
      </p>

      {useBackup ? (
        <form onSubmit={handleBackupSubmit} style={{ margin: '24px 0' }}>
          <input
            type="text"
            value={backupCode}
            onChange={e => setBackupCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            maxLength={9}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box', textAlign: 'center',
              padding: '14px 16px', borderRadius: 12, fontSize: 22, fontWeight: 700,
              fontFamily: 'monospace', letterSpacing: 4,
              border: '1.5px solid #d1d5db', background: '#f9fafb',
              color: '#111827', outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#10b981'; }}
            onBlur={e => { e.target.style.borderColor = '#d1d5db'; }}
          />
          <button
            type="submit"
            className="lp-btn"
            disabled={backupCode.replace(/-/g, '').length < 8 || loading}
            style={{ width: '100%', marginTop: 16 }}
          >
            {loading ? 'Verifying...' : 'Continue →'}
          </button>
        </form>
      ) : (
        <>
          {lockoutTimer <= 0 && (
            <div style={{ margin: '24px 0' }}>
              <OTPInput length={6} onComplete={handleCodeComplete} isLoading={loading} />
            </div>
          )}
        </>
      )}

      <LockoutTimer lockoutTimer={lockoutTimer} />

      {loading && !useBackup && <p style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>Verifying...</p>}

      <button type="button" className="lp-link" onClick={() => { setUseBackup(!useBackup); setBackupCode(''); hideMsg(); }} disabled={loading} style={{ marginTop: '8px' }}>
        {useBackup ? '← Use authenticator app' : '← Use a backup code'}
      </button>
      <button type="button" className="lp-link" onClick={onBack} disabled={loading} style={{ marginTop: '4px' }}>
        ← Back
      </button>
    </>
  );
}
