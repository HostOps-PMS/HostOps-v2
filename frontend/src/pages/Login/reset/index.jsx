import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import './Reset.css';
import Logo from './components/Logo';
import Message from './components/Message';
import ResetPasswordForm from './components/ResetPasswordForm';
import { useResetPassword } from './hooks/useReset';

export default function ResetPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const token = searchParams.get('token');

  const { message, handleReset } = useResetPassword({ email, token });

  const isValidLink = Boolean(email && token);

  return (
    <div className="rst-wrap">
      <div className="rst-card">
        <Logo />
        <h1 className="rst-h1">Set your new password</h1>
        <p className="rst-sub">Choose a strong password — minimum 8 characters.</p>

        {message && <Message text={message.text} type={message.type} />}

        {isValidLink ? (
          <ResetPasswordForm onSubmit={handleReset} />
        ) : (
          <Message text="Invalid or expired reset link. Please request a new one." type="error" />
        )}
      </div>
    </div>
  );
}
