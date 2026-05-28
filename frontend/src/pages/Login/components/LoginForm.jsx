import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/authService';
import { useAuthSubmit } from '../hooks/useAuth';
import { useAuth } from '../../AuthContext';

export default function LoginForm({ showMsg, hideMsg, onForgot, onRequiresOtp }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const { submit, loading } = useAuthSubmit(loginUser, {
    onSuccess: (data) => {
      if (data.requiresOtp) {
        onRequiresOtp(email, rememberMe);
        return;
      }

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

      setTimeout(() => {
        if (data.isAdmin || data.user.role === 'admin') {
          // ✅ Admin: cross-origin redirect to the admin app.
          // Token is passed via URL params since sessionStorage is port-scoped.
          const dashboardBase = import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:5173';
          const params = new URLSearchParams({
            _t: data.accessToken,
            _u: JSON.stringify(data.user),
          });
          window.location.href = `${dashboardBase}/admin?${params.toString()}`;
        } else {
          // ✅ All other users: stay on the same app (5174), no port switch needed.
          navigate('/dashboard', { replace: true });
        }
      }, 800);
    },
    onError: (msg) => showMsg(msg),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    hideMsg();
    let deviceId = localStorage.getItem('hp_device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      localStorage.setItem('hp_device_id', deviceId);
    }
    submit({ email, password, deviceId });
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

        {/* // ---Remember Me-------------- */}
        <div className="lp-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <input 
            type="checkbox" 
            id="rememberMe" 
            checked={rememberMe} 
            onChange={(e) => setRememberMe(e.target.checked)} 
            style={{ width: 'auto', marginBottom: '0' }}
          />
          <label htmlFor="rememberMe" className="lp-label" style={{ marginBottom: '0', cursor: 'pointer' }}>
            Remember Me
          </label>
        </div>
        {/* // ---Remember Me-------------- */}

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