import React, { useState } from 'react';
import { registerUser } from '../services/authService';
import { useAuthSubmit } from '../hooks/useAuth';

export default function RegisterForm({ showMsg, hideMsg, onSuccess }) {
  const [fields, setFields] = useState({
    firstName: '', lastName: '', email: '', password: '',
  });

  const set = (key) => (e) => setFields((prev) => ({ ...prev, [key]: e.target.value }));

  const { submit, loading } = useAuthSubmit(registerUser, {
    onSuccess: () => {
      showMsg('Account created! Check your email for a verification link before signing in.', 'success');
      setFields({ firstName: '', lastName: '', email: '', password: '' });
      onSuccess();
    },
    onError: (msg) => showMsg(msg),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    hideMsg();
    submit(fields);
  };

  return (
    <>
      <h1 className="lp-h1">Create your account</h1>
      <p className="lp-sub">We'll email you a verification link.</p>

      <form onSubmit={handleSubmit}>
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
          <label className="lp-label">Password (min 8 characters)</label>
          <input
            className="lp-input"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={fields.password}
            onChange={set('password')}
          />
        </div>
        <button className="lp-btn" type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
    </>
  );
}