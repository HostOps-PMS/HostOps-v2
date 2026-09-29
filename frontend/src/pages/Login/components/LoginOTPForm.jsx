import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { verifyLoginOtp } from '../services/authservice';
import { useAuthSubmit } from '../hooks/useAuth';
import { useAuth } from '../../AuthContext';
import OTPInput from './OTPInput';
import LockoutTimer from './LockoutTimer';

export default function LoginOTPForm({ email, rememberMe, mfaToken, showMsg, hideMsg, onBack, onAuthSuccess }) {
  const navigate = useNavigate();
  const auth = useAuth();
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

  const { submit, loading } = useAuthSubmit(verifyLoginOtp, {
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

  const handleOTPComplete = (otpValue) => {
    hideMsg();
    const deviceId = localStorage.getItem('hp_device_id');
    submit({ email, otp: otpValue, deviceId, rememberMe, mfaToken });
  };

  return (
    <>
      <h1 className="lp-h1">Device Verification</h1>
      <p className="lp-sub">We sent a 6-digit verification code to <strong>{email}</strong>.</p>

      {lockoutTimer <= 0 && (
        <div style={{ margin: '24px 0' }}>
          <OTPInput length={6} onComplete={handleOTPComplete} isLoading={loading} />
        </div>
      )}

      <LockoutTimer lockoutTimer={lockoutTimer} />
      
      {loading && <p style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>Verifying...</p>}

      <button type="button" className="lp-link" onClick={onBack} disabled={loading} style={{ marginTop: '16px' }}>
        ← Back to sign in
      </button>
    </>
  );
}