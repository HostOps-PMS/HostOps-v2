import { useState } from 'react';
import { useAuthSubmit } from '../hooks/useAuth';

/**
 * @param {(msg: string, type: 'success' | 'error') => void} showMessage
 */
export default function LoginForm({ showMessage }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const { loading, handleSubmit } = useAuthSubmit('login', showMessage);

  function onChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function onSubmit(e) {
    e.preventDefault();
    handleSubmit(form);
  }

  return (
    <>
      <h1 className="lp-h1">Welcome back</h1>
      <p className="lp-sub">Sign in to view your live property dashboard.</p>

      <form onSubmit={onSubmit} autoComplete="on">
        <div className="lp-field">
          <label className="lp-label">Email</label>
          <input
            className="lp-input"
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            required
            autoComplete="email"
          />
        </div>

        <div className="lp-field">
          <label className="lp-label">Password</label>
          <input
            className="lp-input"
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            required
            autoComplete="current-password"
          />
        </div>

        <button className="lp-btn" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </>
  );
}