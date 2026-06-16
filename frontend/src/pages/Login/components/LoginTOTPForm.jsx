import React from 'react';
import { verifyTotpLogin } from '../services/authservice';
import { useAuthSubmit } from '../hooks/useAuth';
import { useAuth } from '../../AuthContext';
import OTPInput from './OTPInput';

export default function LoginTOTPForm({ email, showMsg, hideMsg, onBack, onAuthSuccess }) {
  const auth = useAuth();

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
    onError: (msg) => showMsg(msg),
  });

  const handleCodeComplete = (code) => {
    hideMsg();
    submit({ email, token: code });
  };

  return (
    <>
      <h1 className="lp-h1">Two-Factor Authentication</h1>
      <p className="lp-sub">
        Enter the 6-digit code from your <strong>authenticator app</strong>.
      </p>

      <div style={{ margin: '24px 0' }}>
        <OTPInput length={6} onComplete={handleCodeComplete} isLoading={loading} />
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>Verifying...</p>}

      <button type="button" className="lp-link" onClick={onBack} disabled={loading} style={{ marginTop: '16px' }}>
        ← Back to sign in
      </button>
    </>
  );
}
