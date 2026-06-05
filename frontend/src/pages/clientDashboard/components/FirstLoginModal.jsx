import React, { useState } from 'react';
import { changePassword } from '../../Login/services/authservice';
import safeStorage from '../../safeStorage';

// Inline password validation — mirrors the rules in src/utils/validators.js
function validateNewPassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-z]/.test(password)) return 'Must contain lowercase letters.';
  if (!/[A-Z]/.test(password)) return 'Must contain uppercase letters.';
  if (!/[0-9]/.test(password)) return 'Must contain numbers.';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'Must contain a special character.';
  return null;
}

/**
 * FirstLoginModal
 *
 * Shown automatically when a user logs in for the first time on an
 * admin-created account (mustChangePassword: true). The modal is
 * blocking — it cannot be dismissed without setting a new password.
 *
 * On success:
 *  - Backend sets isVerified: true, mustChangePassword: false
 *  - Frontend clears the hp_must_change_password flag
 *  - Updated user is stored back in sessionStorage
 *  - Modal unmounts and the dashboard becomes fully accessible
 */
export default function FirstLoginModal({ onComplete }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]                     = useState('');
  const [loading, setLoading]                 = useState(false);
  const [success, setSuccess]                 = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const pwError = validateNewPassword(newPassword);
    if (pwError) { setError(pwError); return; }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from your temporary password.');
      return;
    }

    setLoading(true);
    try {
      const data = await changePassword({ currentPassword, newPassword });

      // Update stored user with the fresh user object returned by the backend
      if (data.user) {
        safeStorage.setItem('hp_user', JSON.stringify(data.user));
      }
      sessionStorage.removeItem('hp_must_change_password');

      setSuccess(true);
      setTimeout(() => onComplete(data.user), 1200);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Backdrop — non-dismissible (no onClick on backdrop) */
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        {/* Icon */}
        <div style={styles.iconWrap}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke="#26a676" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2 style={styles.heading}>Set your password</h2>
        <p style={styles.sub}>
          Your account was created with a temporary password. Please set a new
          password to activate your account.
        </p>

        {success ? (
          <div style={styles.successBox}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#26a676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Password set! Loading your dashboard…</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} autoComplete="off">
            <div style={styles.field}>
              <label style={styles.label}>Temporary password</label>
              <input
                style={styles.input}
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setError(''); }}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>New password</label>
              <input
                style={styles.input}
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Confirm new password</label>
              <input
                style={styles.input}
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
              />
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button style={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Set Password & Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(12, 28, 20, 0.55)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px',
  },
  modal: {
    background: '#fff',
    borderRadius: '20px',
    padding: '40px 36px',
    maxWidth: '440px',
    width: '100%',
    boxShadow: '0 8px 40px rgba(38,166,118,.15)',
  },
  iconWrap: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: '#eaf8f1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  heading: {
    fontFamily: "'Sora', sans-serif",
    fontSize: '1.3rem',
    fontWeight: 800,
    color: '#0c1c14',
    textAlign: 'center',
    margin: '0 0 8px',
  },
  sub: {
    fontSize: '0.875rem',
    color: '#6b8f7a',
    textAlign: 'center',
    lineHeight: 1.6,
    margin: '0 0 28px',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '6px',
    letterSpacing: '0.02em',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid #d1fae5',
    borderRadius: '10px',
    fontSize: '0.925rem',
    color: '#0c1c14',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    background: '#f9fdfb',
  },
  error: {
    fontSize: '0.825rem',
    color: '#c13515',
    margin: '0 0 14px',
    textAlign: 'center',
  },
  btn: {
    width: '100%',
    padding: '13px',
    background: 'linear-gradient(135deg, #26a676 0%, #1e8760 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '4px',
    letterSpacing: '0.02em',
    transition: 'opacity 0.2s',
  },
  successBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '20px',
    background: '#eaf8f1',
    borderRadius: '12px',
    color: '#1e8760',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
};