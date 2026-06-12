import React, { useState } from 'react';
import { changePin } from '../../Login/services/authservice';
import { useAuth } from '../../AuthContext';
import safeStorage from '../../safeStorage';
import FetchingOverlay from './FetchingOverlay';

// Inline validation for exactly 6 digits
function validateNewPin(pin) {
  if (!/^\d{6}$/.test(pin)) return 'PIN must be exactly 6 digits.';
  return null;
}

/**
 * FirstLoginPinModal
 *
 * Shown automatically when a user logs in for the first time and
 * mustChangePin is true. The modal is blocking.
 *
 * On success:
 *  - Backend sets mustChangePin: false
 *  - Frontend clears the hp_must_change_pin flag
 *  - Updated user is stored back in local storage
 *  - Modal unmounts and dashboard becomes accessible
 */
export default function FirstLoginPinModal({ onComplete }) {
  const auth = useAuth();

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin]         = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const pinError = validateNewPin(newPin);
    if (pinError) { setError(pinError); return; }

    if (newPin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }
    if (currentPin === newPin) {
      setError('New PIN must be different from your temporary PIN.');
      return;
    }

    setLoading(true);
    try {
      // ── FIX: pass the in-memory access token so the backend's
      // requireAuth middleware receives the Authorization header.
      // Without this, the request arrives with no Bearer token and
      // the server returns 401 "Missing token".
      const currentToken = auth.getToken();
      const data = await changePin({ currentPin, newPin }, currentToken);

      // Construct the full updated user object
      let updatedUser = null;
      if (data.user) {
        updatedUser = data.user;
      } else if (data.staff) {
        updatedUser = { ...data.staff, isStaff: true, role: 'staff' };
      }

      // Update stored user with the fresh user object returned by the backend
      if (updatedUser) {
        safeStorage.setItem('hp_user', JSON.stringify(updatedUser));
      }
      sessionStorage.removeItem('hp_must_change_pin');

      setSuccess(true);
      setTimeout(() => onComplete(updatedUser), 1200);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (setter) => (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setter(val);
    setError('');
  };

  return (
    <>
      <FetchingOverlay
        isVisible={loading}
        message="Verifying PIN…"
        subMessage="Please wait a moment"
      />
      <FetchingOverlay
        isVisible={success}
        message="PIN set successfully!"
        subMessage="Loading your dashboard…"
      />

      {!loading && !success && (
        <div style={styles.backdrop}>
          <div style={styles.modal}>
            {/* Icon */}
            <div style={styles.iconWrap}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke="#26a676" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </div>

            <h2 style={styles.heading}>Set your PIN</h2>
            <p style={styles.sub}>
              Your account was created with a temporary PIN. Please set a new
              6-digit PIN to secure your account.
            </p>

            <form onSubmit={handleSubmit} autoComplete="off">
              <div style={styles.field}>
                <label style={styles.label}>Temporary PIN</label>
                <input
                  style={styles.input}
                  type="password"
                  inputMode="numeric"
                  required
                  value={currentPin}
                  onChange={handleInput(setCurrentPin)}
                  placeholder="6 digits"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>New PIN</label>
                <input
                  style={styles.input}
                  type="password"
                  inputMode="numeric"
                  required
                  value={newPin}
                  onChange={handleInput(setNewPin)}
                  placeholder="6 digits"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Confirm new PIN</label>
                <input
                  style={styles.input}
                  type="password"
                  inputMode="numeric"
                  required
                  value={confirmPin}
                  onChange={handleInput(setConfirmPin)}
                  placeholder="6 digits"
                />
              </div>

              {error && <p style={styles.error}>{error}</p>}

              <button style={styles.btn} type="submit">
                Set PIN &amp; Continue
              </button>
            </form>
          </div>
        </div>
      )}
    </>
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
    textAlign: 'center',
    letterSpacing: '0.2em',
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
};