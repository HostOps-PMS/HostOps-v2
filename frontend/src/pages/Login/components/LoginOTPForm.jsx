import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyLoginOtp } from '../services/authService';
import { useAuthSubmit } from '../hooks/useAuth';
import { useAuth } from '../../AuthContext';
import OTPInput from './OTPInput';

export default function LoginOTPForm({ email, rememberMe, showMsg, hideMsg, onBack }) {
  const navigate = useNavigate();
  const auth = useAuth();

  const { submit, loading } = useAuthSubmit(verifyLoginOtp, {
    onSuccess: (data) => {
      auth.setToken(data.accessToken);
      auth.setUser(data.user);

      if (data.user.mustChangePassword) {
        sessionStorage.setItem('hp_must_change_password', 'true');
      } else {
        sessionStorage.removeItem('hp_must_change_password');
      }

      showMsg(`OTP Verified. Welcome back, ${data.user.firstName}! Redirecting...`, 'success');

      setTimeout(() => {
        if (data.isAdmin || data.user.tag === 'Main Admin') {
          const dashboardBase = import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:5173';
          const params = new URLSearchParams({
            _t: data.accessToken,
            _u: JSON.stringify(data.user),
          });
          window.location.href = `${dashboardBase}/admin?${params.toString()}`;
        } else {
          navigate('/dashboard', { replace: true });
        }
      }, 800);
    },
    onError: (msg) => showMsg(msg),
  });

  const handleOTPComplete = (otpValue) => {
    hideMsg();
    const deviceId = localStorage.getItem('hp_device_id');
    submit({ email, otp: otpValue, deviceId, rememberMe });
  };

  return (
    <>
      <h1 className="lp-h1">Device Verification</h1>
      <p className="lp-sub">We sent a 6-digit verification code to <strong>{email}</strong>.</p>

      <div style={{ margin: '24px 0' }}>
        <OTPInput length={6} onComplete={handleOTPComplete} isLoading={loading} />
      </div>
      
      {loading && <p style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>Verifying...</p>}

      <button type="button" className="lp-link" onClick={onBack} disabled={loading} style={{ marginTop: '16px' }}>
        ← Back to sign in
      </button>
    </>
  );
}
