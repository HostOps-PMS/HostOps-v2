import React, { useState } from 'react';
import { validatePassword } from '../../Login/utils/validators';
import PasswordStrengthIndicator from '../../Login/components/PasswordStrengthIndicator';

export default function ResetForm({ onSubmit, loading, errorMsg, hideError }) {
  const [fields, setFields] = useState({ password: '', confirmPassword: '' });
  const [localError, setLocalError] = useState('');

  const set = (key) => (e) => {
    setFields((prev) => ({ ...prev, [key]: e.target.value }));
    hideError();
    setLocalError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    hideError();
    setLocalError('');

    // Security protection: Validate strict rules before calling API
    const validation = validatePassword(fields.password);
    if (!validation.isValid) {
      setLocalError(validation.errors[0]);
      return;
    }

    if (fields.password !== fields.confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    onSubmit(fields.password);
  };

  return (
    <form onSubmit={handleSubmit} autoComplete="off">
      {(localError || errorMsg) && (
        <div className="rs-msg error">{localError || errorMsg}</div>
      )}

      <div className="rs-field">
        <label className="rs-label">New password</label>
        <input
          className="rs-input"
          type="password"
          required
          autoComplete="new-password"
          value={fields.password}
          onChange={set('password')}
        />
        <PasswordStrengthIndicator 
          password={fields.password} 
          confirmPassword={fields.confirmPassword} 
        />
      </div>

      <div className="rs-field">
        <label className="rs-label">Confirm new password</label>
        <input
          className="rs-input"
          type="password"
          required
          autoComplete="new-password"
          value={fields.confirmPassword}
          onChange={set('confirmPassword')}
        />
      </div>

      <button className="rs-btn" type="submit" disabled={loading}>
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>
    </form>
  );
}
