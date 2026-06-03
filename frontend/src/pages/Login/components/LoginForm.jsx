import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/authservice';
import { useAuthSubmit } from '../hooks/useAuth';
import { useAuth } from '../../AuthContext';

export default function LoginForm({ showMsg, hideMsg, onForgot, onRequiresOtp, onClientAccountLogin, onAuthSuccess }) {
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

      // ── Client Account login ───────────────────────────────────────
      // Client accounts skip OTP and DomainLoginForm entirely.
      // Token is stored here; PropertySelectForm will use it to fetch
      // the parent client's properties from /api/properties.
      if (data.isClientAccount) {
        auth.setToken(data.accessToken);
        auth.setUser({ ...data.clientAccount, role: 'clientAccount', isClientAccount: true });

        if (data.mustChangePassword) {
          sessionStorage.setItem('hp_must_change_password', 'true');
        } else {
          sessionStorage.removeItem('hp_must_change_password');
        }

        // ✅ Client accounts now redirect to the admin dashboard (same as
        // admin/team_leader). Token is passed via URL params since sessionStorage
        // is port-scoped. The AuthorizationModal OTP gate on the admin app will
        // intercept and require verification before granting access.
        showMsg(`Welcome, ${data.clientAccount.firstName}! Redirecting...`, 'success');
        setTimeout(() => {
          const dashboardBase = import.meta.env.VITE_DASHBOARD_URL || 'https://core.hostops.online';
          const params = new URLSearchParams({
            _t: data.accessToken,
            _u: JSON.stringify({ ...data.clientAccount, role: 'clientAccount', isClientAccount: true }),
          });
          window.location.href = `${dashboardBase}/admin?${params.toString()}`;
        }, 800);
        return;
      }

      auth.setToken(data.accessToken);

      // Staff login returns data.staff (not data.user).
      // Normalise so auth context and downstream handlers always have data.user.
      if (data.isStaff && data.staff && !data.user) {
        data = { ...data, user: { ...data.staff, role: 'staff', isStaff: true } };
      }

      auth.setUser(data.user);

      // If the account was admin-created with a temporary password,
      // flag it so the dashboard shows the first-login password-change modal.
      if (data.user?.mustChangePassword) {
        sessionStorage.setItem('hp_must_change_password', 'true');
      } else {
        sessionStorage.removeItem('hp_must_change_password');
      }

      onAuthSuccess(data);
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