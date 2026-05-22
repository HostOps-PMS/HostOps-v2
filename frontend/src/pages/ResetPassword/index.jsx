import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword } from './services/resetService';
import { useResetSubmit } from './hooks/useResetSubmit';
import ResetForm from './components/ResetForm';
import './ResetPassword.css';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Security protection: strict token parameter checking
  const email = searchParams.get('email');
  const token = searchParams.get('token');
  const isValidParams = email && token;

  const [msg, setMsg] = useState({ text: '', type: '' });

  const showMsg = (text, type = 'error') => setMsg({ text, type });
  const hideMsg = () => setMsg({ text: '', type: '' });

  const { submit, loading } = useResetSubmit(resetPassword, {
    onSuccess: () => {
      showMsg('Password reset successfully! Redirecting to sign in...', 'success');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);
    },
    onError: (errorMsg) => {
      showMsg(errorMsg, 'error');
    }
  });

  const handleReset = (newPassword) => {
    submit(email, token, newPassword);
  };

  return (
    <div className="rs-wrap">
      <div className="rs-card">
        <h1 className="rs-h1">Set your new password</h1>
        <p className="rs-sub">Choose a strong password (at least 8 characters).</p>
        
        {(!isValidParams || msg.text) && (
          <div className={`rs-msg ${!isValidParams ? 'error' : msg.type}`}>
            {!isValidParams ? 'Invalid or expired reset link.' : msg.text}
          </div>
        )}

        {isValidParams && (
          <ResetForm 
            onSubmit={handleReset} 
            loading={loading} 
            errorMsg={msg.type === 'error' ? msg.text : ''} 
            hideError={hideMsg} 
          />
        )}
      </div>
    </div>
  );
}
