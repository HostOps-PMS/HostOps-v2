import React from 'react';

export default function LoginVerifyMethodForm({ email, onChooseTotp, onChooseEmail, onBack }) {
  return (
    <>
      <h1 className="lp-h1">Verify your identity</h1>
      <p className="lp-sub">
        Your account has two-factor authentication enabled. Choose how you want to verify.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '28px 0' }}>

        {/* Authenticator App option */}
        <button
          type="button"
          onClick={onChooseTotp}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            '16px',
            padding:        '16px 18px',
            border:         '1.5px solid #d1d5db',
            borderRadius:   '12px',
            background:     '#fff',
            cursor:         'pointer',
            textAlign:      'left',
            transition:     'border-color 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.10)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <div style={{
            width:          '40px',
            height:         '40px',
            borderRadius:   '10px',
            background:     'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
              <line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Authenticator App</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Use the 6-digit code from your authenticator app</div>
          </div>
          <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        {/* Email code option */}
        <button
          type="button"
          onClick={onChooseEmail}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            '16px',
            padding:        '16px 18px',
            border:         '1.5px solid #d1d5db',
            borderRadius:   '12px',
            background:     '#fff',
            cursor:         'pointer',
            textAlign:      'left',
            transition:     'border-color 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.10)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <div style={{
            width:          '40px',
            height:         '40px',
            borderRadius:   '10px',
            background:     'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Email Code</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              We sent a code to <strong style={{ color: '#374151' }}>{email}</strong>
            </div>
          </div>
          <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

      </div>

      <button type="button" className="lp-link" onClick={onBack} style={{ marginTop: '4px' }}>
        ← Back to sign in
      </button>
    </>
  );
}
