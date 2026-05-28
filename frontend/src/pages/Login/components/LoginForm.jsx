import React, { useState } from 'react';
import { loginUser } from '../services/authService';
import { useAuthSubmit } from '../hooks/useAuth';
import { useAuth } from '../../AuthContext';

export default function LoginForm({ showMsg, hideMsg, onForgot }) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { submit, loading } = useAuthSubmit(loginUser, {
    onSuccess: (data) => {
      // Store in the login app's own sessionStorage as well
      // (used by AuthContext on this side if needed)
      auth.setToken(data.accessToken);
      auth.setUser(data.user);

      // If the account was admin-created with a temporary password,
      // flag it so the dashboard shows the first-login password-change modal.
      if (data.user.mustChangePassword) {
        sessionStorage.setItem('hp_must_change_password', 'true');
      } else {
        sessionStorage.removeItem('hp_must_change_password');
      }

      showMsg(`Welcome back, ${data.user.firstName}! Redirecting...`, 'success');

      // ✅ FIX: sessionStorage is scoped per origin+port.
      // A token set on localhost:5174 is invisible to localhost:5173.
      // Solution: pass token + user via URL query params so the dashboard
      // app's AuthContext can consume and store them in its own sessionStorage.
      // AuthContext will clean the URL immediately after consuming.
      setTimeout(() => {
        const dashboardBase = import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:5173';
        const params = new URLSearchParams({
          _t: data.accessToken,
          _u: JSON.stringify(data.user),
        });
        window.location.href = `${dashboardBase}/dashboard?${params.toString()}`;
      }, 800);
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
      <p className="lp-sub">Log in to view your live property dashboard.</p>

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
          {loading ? 'Signing in...' : 'Log In'}
        </button>
        <button type="button" className="lp-link" onClick={onForgot}>
          Forgot password?
        </button>
      </form>
    </>
  );
}