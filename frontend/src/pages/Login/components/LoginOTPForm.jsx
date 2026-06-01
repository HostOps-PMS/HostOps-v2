import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyLoginOtp } from '../services/authService';
import { useAuthSubmit } from '../hooks/useAuth';
import { useAuth } from '../../AuthContext';
import OTPInput from './OTPInput';

export default function LoginOTPForm({ email, rememberMe, showMsg, hideMsg, onBack, onAuthSuccess }) {
  const navigate = useNavigate();
  const auth = useAuth();

  const { submit, loading } = useAuthSubmit(verifyLoginOtp, {
    onSuccess: (data) => {
      // ── Client Account post-OTP redirect ───────────────────────────
      // verify-login-otp returns { accessToken, clientAccount, isClientAccount: true }
      // for clientAccount logins. Store token/user and redirect to dashboard.
      if (data.isClientAccount) {
        const user = { ...data.clientAccount, role: 'clientAccount', isClientAccount: true };
        auth.setToken(data.accessToken);
        auth.setUser(user);

        if (data.clientAccount.mustChangePassword) {
          sessionStorage.setItem('hp_must_change_password', 'true');
        } else {
          sessionStorage.removeItem('hp_must_change_password');
        }

        showMsg(`Welcome, ${data.clientAccount.firstName}! Redirecting...`, 'success');
        setTimeout(() => {
          const dashboardBase = import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:5174';
          const params = new URLSearchParams({
            _t: data.accessToken,
            _u: JSON.stringify(user),
          });
          window.location.href = `${dashboardBase}/admin?${params.toString()}`;
        }, 800);
        return;
      }

      // ── Client / Team Leader post-OTP redirect ─────────────────────
      // After OTP verification, client and team_leader go directly to
      // the dashboard. Token passed via URL params (sessionStorage is port-scoped).
      if (data.user?.role === 'client' || data.user?.role === 'team_leader') {
        auth.setToken(data.accessToken);
        auth.setUser(data.user);

        if (data.user.mustChangePassword) {
          sessionStorage.setItem('hp_must_change_password', 'true');
        } else {
          sessionStorage.removeItem('hp_must_change_password');
        }

        showMsg(`Welcome, ${data.user.firstName}! Redirecting...`, 'success');
        setTimeout(() => {
          const dashboardBase = import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:5174';
          const params = new URLSearchParams({
            _t: data.accessToken,
            _u: JSON.stringify(data.user),
          });
          window.location.href = `${dashboardBase}/admin?${params.toString()}`;
        }, 800);
        return;
      }

      // ── Admin / all other roles ────────────────────────────────────
      // Fall through to the parent's onAuthSuccess handler.
      auth.setToken(data.accessToken);
      auth.setUser(data.user);

      if (data.user.mustChangePassword) {
        sessionStorage.setItem('hp_must_change_password', 'true');
      } else {
        sessionStorage.removeItem('hp_must_change_password');
      }

      onAuthSuccess(data);
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