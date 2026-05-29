import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { staffLogin } from '../services/authservice';
import { useAuth } from '../../AuthContext';

// ─────────────────────────────────────────────────────────────────
// DomainLoginForm
//
// Staff login step — shown after property selection.
// Accepts staff email + password, calls POST /auth/staff-login,
// then verifies that the returned staff account has access to the
// property the user selected in PropertySelectForm.
//
// Property ID matching is done with String() coercion on BOTH sides:
//   - selectedPropertyId comes from PropertySelectForm as a string
//     (Smoobu apartment id coerced to String before passing via onContinue)
//   - staff.propertyIds from the backend is an array of strings (["3261782"])
// Both sides are String() coerced again here as a safety net, since
// Smoobu returns apartment IDs as numbers but the Staff schema stores
// them as strings — consistent coercion prevents type mismatch rejections.
//
// If credentials are valid BUT the staff member does not have access
// to the selected property, login is rejected with a clear error.
// ─────────────────────────────────────────────────────────────────
export default function DomainLoginForm({ userData, selectedPropertyId, showMsg, hideMsg, onBack }) {
  const navigate = useNavigate();
  const auth = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async () => {
    hideMsg();

    if (!email.trim()) {
      showMsg('Please enter your staff email.');
      return;
    }
    if (!password) {
      showMsg('Please enter your password.');
      return;
    }
    // Guard: selectedPropertyId must be present (passed from PropertySelectForm)
    if (!selectedPropertyId) {
      showMsg('No property selected. Please go back and select a property.');
      return;
    }

    setLoading(true);

    try {
      const data = await staffLogin({ email: email.trim(), password });

      // ── Property access check ──────────────────────────────────────
      // staff.propertyIds = ["3261782"] (strings, from Staff model)
      // selectedPropertyId = "3261782" (string, coerced in PropertySelectForm)
      // Coerce both sides to String again as a safety net against any
      // upstream type inconsistency.
      const staffPropertyIds = (data.staff?.propertyIds || []).map(String);
      const chosenId = String(selectedPropertyId);

      if (!staffPropertyIds.includes(chosenId)) {
        showMsg(
          'You do not have access to the selected property. Please use an account assigned to this property.',
        );
        setLoading(false);
        return;
      }

      // ── Auth success ───────────────────────────────────────────────
      // Store the staff access token and staff record.
      auth.setToken(data.accessToken);
      auth.setUser(data.staff);

      // Persist the selected property ID so the dashboard scopes its
      // data to this single property from the start.
      sessionStorage.setItem('hp_selected_properties', JSON.stringify([chosenId]));

      // If first-login, flag it for the dashboard's password-change modal.
      if (data.mustChangePassword) {
        sessionStorage.setItem('hp_must_change_password', 'true');
      } else {
        sessionStorage.removeItem('hp_must_change_password');
      }

      showMsg(`Welcome, ${data.staff.firstName}! Redirecting…`, 'success');

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 800);

    } catch (err) {
      showMsg(err.message || 'Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <>
      <h1 className="lp-h1">Staff Sign In</h1>
      <p className="lp-sub">
        Enter your staff credentials to access the selected property.
      </p>

      <div style={{ marginTop: '24px' }}>
        {/* Staff email field */}
        <div style={{ marginBottom: '16px' }}>
          <label className="lp-label" htmlFor="dl-email">
            Staff Email
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="dl-email"
              className="lp-input"
              type="email"
              placeholder="staff@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoFocus
              autoComplete="username"
              style={{ paddingRight: email ? '42px' : undefined }}
            />
            {/* Clear button */}
            {email && !loading && (
              <button
                type="button"
                onClick={() => setEmail('')}
                aria-label="Clear email"
                style={{
                  position:   'absolute',
                  right:      '12px',
                  top:        '50%',
                  transform:  'translateY(-50%)',
                  background: 'none',
                  border:     'none',
                  cursor:     'pointer',
                  padding:    '0',
                  color:      '#9ab8a9',
                  display:    'flex',
                  alignItems: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Password field */}
        <div style={{ marginBottom: '24px' }}>
          <label className="lp-label" htmlFor="dl-password">
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="dl-password"
              className="lp-input"
              type={showPass ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoComplete="current-password"
              style={{ paddingRight: '42px' }}
            />
            {/* Show / hide toggle */}
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              style={{
                position:   'absolute',
                right:      '12px',
                top:        '50%',
                transform:  'translateY(-50%)',
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                padding:    '0',
                color:      '#9ab8a9',
                display:    'flex',
                alignItems: 'center',
              }}
            >
              {showPass ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          className="lp-btn"
          onClick={handleSubmit}
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{
                display:        'inline-block',
                width:          '14px',
                height:         '14px',
                border:         '2px solid rgba(255,255,255,0.4)',
                borderTopColor: 'white',
                borderRadius:   '50%',
                animation:      'lp-spin 0.7s linear infinite',
              }} />
              Signing in…
            </span>
          ) : (
            'Sign In'
          )}
        </button>
      </div>

      <button
        type="button"
        className="lp-link"
        onClick={onBack}
        disabled={loading}
        style={{ marginTop: '16px' }}
      >
        ← Back to properties
      </button>

      <style>{`
        @keyframes lp-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}