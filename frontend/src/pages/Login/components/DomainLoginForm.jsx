import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────
// DomainLoginForm
//
// Second authentication step after property selection.
// UI is fully built; backend integration is pending.
// For now, submitting stores the domain in sessionStorage and
// proceeds to the dashboard normally.
// ─────────────────────────────────────────────────────────────────
export default function DomainLoginForm({ userData, showMsg, hideMsg, onBack }) {
  const navigate = useNavigate();

  const [domain,   setDomain]   = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async () => {
    hideMsg();

    if (!domain.trim()) {
      showMsg('Please enter your domain.');
      return;
    }
    if (!password) {
      showMsg('Please enter your domain password.');
      return;
    }

    setLoading(true);

    // TODO: Replace with real backend call once domain auth is implemented.
    // e.g. POST /auth/domain-login  { domain, password }
    sessionStorage.setItem('hp_domain', domain.trim().toLowerCase());

    // Simulate a brief loading state then navigate
    setTimeout(() => {
      setLoading(false);
      navigate('/dashboard', { replace: true });
    }, 600);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <>
      <h1 className="lp-h1">Domain Login</h1>
      <p className="lp-sub">
        Enter your domain credentials to access your workspace.
      </p>

      <div style={{ marginTop: '24px' }}>
        {/* Domain field */}
        <div style={{ marginBottom: '16px' }}>
          <label className="lp-label" htmlFor="dl-domain">
            Domain
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="dl-domain"
              className="lp-input"
              type="text"
              placeholder="your-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoFocus
              autoComplete="username"
              style={{ paddingRight: domain ? '42px' : undefined }}
            />
            {/* Clear button */}
            {domain && !loading && (
              <button
                type="button"
                onClick={() => setDomain('')}
                aria-label="Clear domain"
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
              placeholder="Enter your domain password"
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
                // Eye-off icon
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                // Eye icon
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
                display:      'inline-block',
                width:        '14px',
                height:       '14px',
                border:       '2px solid rgba(255,255,255,0.4)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation:    'lp-spin 0.7s linear infinite',
              }} />
              Signing in…
            </span>
          ) : (
            'Sign in'
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

      {/* Spinner keyframes */}
      <style>{`
        @keyframes lp-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
