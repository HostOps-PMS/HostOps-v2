import React, { useState } from 'react';

/**
 * ResetPasswordForm.jsx
 * Props:
 *   onSubmit  {(password: string) => Promise<void>}
 */
export default function ResetPasswordForm({ onSubmit }) {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [localErr, setLocalErr]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalErr('');

    if (password !== confirm) {
      setLocalErr('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(password);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form id="rst-form" onSubmit={handleSubmit} noValidate>
      {localErr && (
        <div className="lp-msg error show" role="alert">
          {localErr}
        </div>
      )}

      <div className="lp-field">
        <label className="lp-label" htmlFor="rst-password">
          New password
        </label>
        <input
          id="rst-password"
          className="lp-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div className="lp-field">
        <label className="lp-label" htmlFor="rst-confirm">
          Confirm password
        </label>
        <input
          id="rst-confirm"
          className="lp-input"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <button className="lp-btn" type="submit" disabled={loading} style={{ background: '#26a676', color: '#fff', border: 'none' }}>
        {loading ? 'Resetting…' : 'Reset Password'}
      </button>
    </form>
  );
}
