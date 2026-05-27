import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/authService';
import { useAuthSubmit } from '../hooks/useAuth';

export default function LoginForm({ showMsg, hideMsg, onForgot }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { submit, loading } = useAuthSubmit(loginUser, {
    onSuccess: (data) => {
      sessionStorage.setItem('hp_access_token', data.accessToken);
      sessionStorage.setItem('hp_user', JSON.stringify(data.user));

      // If the account was admin-created with a temporary password,
      // flag it so the dashboard shows the first-login password-change modal.
      if (data.user.mustChangePassword) {
        sessionStorage.setItem('hp_must_change_password', 'true');
      } else {
        sessionStorage.removeItem('hp_must_change_password');
      }

      showMsg(`Welcome back, ${data.user.firstName}! Redirecting...`, 'success');
      setTimeout(() => navigate('/dashboard', { replace: true }), 800);
    },
    onError: (msg) => showMsg(msg),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    hideMsg();
    submit({ email, password });
  };

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
          <input
            className="lp-input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
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