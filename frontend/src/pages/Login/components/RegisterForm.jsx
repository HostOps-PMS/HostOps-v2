import React, { useState } from 'react';
import { registerUser } from '../services/authservice';
import { useAuthSubmit } from '../hooks/useAuth';
import { validateRegistration } from '../utils/validators';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import { useNavigate } from 'react-router';

export default function RegisterForm({ showMsg, hideMsg, onSuccess }) {
  const [fields, setFields] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
  });

  const set = (key) => (e) => {
    setFields((prev) => ({ ...prev, [key]: e.target.value }));
    hideMsg(); // clear errors on typing
  };

  const navigate = useNavigate();

  const { submit, loading } = useAuthSubmit(registerUser, {
    onSuccess: () => {
      navigate(`/verify-email?email=${encodeURIComponent(fields.email)}`);
    },
    onError: (msg) => showMsg(msg),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    hideMsg();
    
    // Security protection: strict validation before submission
    const validation = validateRegistration(fields);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      showMsg(firstError, 'error');
      return;
    }
    
    // Omit confirmPassword from the actual API payload
    const payload = { ...fields };
    delete payload.confirmPassword;
    
    submit(payload);
  };

  return (
    <>
      <h1 className="lp-h1">Create your account</h1>
      <p className="lp-sub">We'll email you a verification link.</p>

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="lp-field">
          <label className="lp-label">First name</label>
          <input className="lp-input" type="text" required value={fields.firstName} onChange={set('firstName')} />
        </div>
        <div className="lp-field">
          <label className="lp-label">Last name</label>
          <input className="lp-input" type="text" required value={fields.lastName} onChange={set('lastName')} />
        </div>
        <div className="lp-field">
          <label className="lp-label">Email</label>
          <input className="lp-input" type="email" required autoComplete="email" value={fields.email} onChange={set('email')} />
        </div>
        <div className="lp-field">
          <label className="lp-label">Password</label>
          <input
            className="lp-input"
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
        <div className="lp-field">
          <label className="lp-label">Confirm password</label>
          <input
            className="lp-input"
            type="password"
            required
            autoComplete="new-password"
            value={fields.confirmPassword}
            onChange={set('confirmPassword')}
          />
        </div>
        <button className="lp-btn" type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
    </>
  );
}