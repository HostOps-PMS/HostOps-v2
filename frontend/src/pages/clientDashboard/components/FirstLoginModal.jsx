import React, { useState } from 'react';
import { FiLock, FiAlertCircle } from 'react-icons/fi';
import { setSecureUser } from '../../../lib/secureUserStorage';
import { changePassword } from '../../Login/services/authservice';
import safeStorage from '../../safeStorage';
import FetchingOverlay from './FetchingOverlay';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../../AuthContext';

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
  const { dark } = useDashboard();
  const { getToken, setToken, setSessionKey } = useAuth();
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
      const data = await changePassword({ currentPassword, newPassword }, getToken());

      // Store the fresh token pair returned by the backend so the
      // subsequent mustChangePin step can authenticate without re-login.
      if (data.accessToken) {
        setToken(data.accessToken);
        if (data.sk) setSessionKey(data.sk);
      }

      // Update stored user with the fresh user object returned by the backend
      if (data.user) {
        setSecureUser(data.user);
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
    <>
      <FetchingOverlay
        isVisible={loading}
        message="Verifying password…"
        subMessage="Please wait a moment"
      />
      <FetchingOverlay
        isVisible={success}
        message="Password set successfully!"
        subMessage="Loading your dashboard…"
      />

      {!loading && !success && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(12, 28, 20, 0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: dark ? '#132a1e' : '#fff', borderRadius: '20px', padding: '40px 36px', maxWidth: '440px', width: '100%', boxShadow: '0 8px 40px rgba(38,166,118,.15)' }}>
            {/* Icon */}
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: dark ? '#0f2d1a' : '#eaf8f1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke="#26a676" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: '1.3rem', fontWeight: 800, color: dark ? '#eaf5f0' : '#0c1c14', textAlign: 'center', margin: '0 0 8px' }}>Set your password</h2>
            <p style={{ fontSize: '0.875rem', color: dark ? '#9ab8a9' : '#6b8f7a', textAlign: 'center', lineHeight: 1.6, margin: '0 0 28px' }}>
              Your account was created with a temporary password. Please set a new
              password to activate your account.
            </p>

            <form onSubmit={handleSubmit} autoComplete="off">
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: dark ? '#9ab8a9' : '#374151', marginBottom: '6px', letterSpacing: '0.02em' }}>Temporary password</label>
                <input
                  style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${dark ? '#2a5c3c' : '#d1fae5'}`, borderRadius: '10px', fontSize: '0.925rem', color: dark ? '#eaf5f0' : '#0c1c14', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s', background: dark ? '#0a1f15' : '#f9fdfb' }}
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setError(''); }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: dark ? '#9ab8a9' : '#374151', marginBottom: '6px', letterSpacing: '0.02em' }}>New password</label>
                <input
                  style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${dark ? '#2a5c3c' : '#d1fae5'}`, borderRadius: '10px', fontSize: '0.925rem', color: dark ? '#eaf5f0' : '#0c1c14', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s', background: dark ? '#0a1f15' : '#f9fdfb' }}
                  type="password"
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: dark ? '#9ab8a9' : '#374151', marginBottom: '6px', letterSpacing: '0.02em' }}>Confirm new password</label>
                <input
                  style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${dark ? '#2a5c3c' : '#d1fae5'}`, borderRadius: '10px', fontSize: '0.925rem', color: dark ? '#eaf5f0' : '#0c1c14', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s', background: dark ? '#0a1f15' : '#f9fdfb' }}
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                />
              </div>

              {error && <p style={{ fontSize: '0.825rem', color: '#c13515', margin: '0 0 14px', textAlign: 'center' }}>{error}</p>}

              <button style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg, #26a676 0%, #1e8760 100%)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', marginTop: '4px', letterSpacing: '0.02em', transition: 'opacity 0.2s' }} type="submit">
                Set Password &amp; Continue
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}