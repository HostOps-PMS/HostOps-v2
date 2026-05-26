import React, { useState } from 'react';
import { forgotPassword } from '../services/authService';
import { useAuthSubmit } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function ForgotPasswordForm({ showMsg, onBack }) {
  const [email, setEmail] = useState('');

  const navigate = useNavigate();

  const { submit, loading } = useAuthSubmit(forgotPassword, {
    onSuccess: () => navigate(`/reset-password?email=${encodeURIComponent(email)}`),
    onError: () => showMsg('Something went wrong. Please try again.'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    submit({ email });
  };

  return (
    <>
      <h1 className="lp-h1">Reset your password</h1>
      <p className="lp-sub">We'll email you a reset link.</p>

      <form onSubmit={handleSubmit}>
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
        <button className="lp-btn" type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
        <button type="button" className="lp-link" onClick={onBack}>
          ← Back to sign in
        </button>
      </form>
    </>
  );
}