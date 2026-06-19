export default function RecoveryModal({
  show,
  email,
  reason,
  onReasonChange,
  onSubmit,
  onClose,
  loading,
  submitted,
  title       = 'Recover Account',
  description = 'Tell us why your account was locked. Your request will be reviewed by an administrator.',
  label       = 'Why was your account locked?',
  placeholder = 'e.g. I forgot my PIN after returning from a 2-week trip and entered it incorrectly multiple times.',
  submitLabel = 'Submit Recovery Request',
}) {
  if (!show) return null;

  const minLength = 10;
  const canSubmit = reason.trim().length >= minLength && !loading;

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={onClose}
        style={{
          position:       'fixed',
          inset:          0,
          background:     'rgba(10, 20, 15, 0.55)',
          zIndex:         1000,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '16px',
          backdropFilter: 'blur(6px)',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background:   '#ffffff',
            borderRadius: '24px',
            width:        '100%',
            maxWidth:     '440px',
            boxShadow:    '0 32px 80px rgba(0,0,0,0.22)',
            position:     'relative',
            animation:    'recovery-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow:     'hidden',
          }}
        >
          {submitted ? (
            /* ── Success state ── */
            <div style={{ padding: '48px 32px', textAlign: 'center' }}>
              <div style={{
                width:          '64px',
                height:         '64px',
                borderRadius:   '50%',
                background:     'linear-gradient(135deg, #eaf8f1 0%, #d1f5e3 100%)',
                border:         '2px solid #26a676',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                margin:         '0 auto 20px',
                boxShadow:      '0 8px 24px rgba(38,166,118,0.2)',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#26a676" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0c1c14', margin: '0 0 10px' }}>
                Request Submitted
              </h2>
              <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.65', margin: '0 0 28px', maxWidth: '300px', marginLeft: 'auto', marginRight: 'auto' }}>
                Your request has been sent. An administrator will review it and contact you shortly.
              </p>
              <button
                type="button"
                className="lp-btn"
                onClick={onClose}
                style={{ width: '100%' }}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* ── Colored header band ── */}
              <div style={{
                background:    'linear-gradient(135deg, #0c1c14 0%, #1a3328 100%)',
                padding:       '28px 28px 24px',
                position:      'relative',
              }}>
                {/* Close button */}
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    position:   'absolute',
                    top:        '16px',
                    right:      '16px',
                    background: 'rgba(255,255,255,0.1)',
                    border:     'none',
                    cursor:     'pointer',
                    color:      'rgba(255,255,255,0.7)',
                    lineHeight: 1,
                    padding:    '7px',
                    borderRadius: '8px',
                    display:    'flex',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  aria-label="Close"
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>

                {/* Icon */}
                <div style={{
                  width:          '44px',
                  height:         '44px',
                  borderRadius:   '12px',
                  background:     'rgba(38,166,118,0.18)',
                  border:         '1px solid rgba(38,166,118,0.35)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  marginBottom:   '14px',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="#26a676" strokeWidth="1.8"/>
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#26a676" strokeWidth="1.8" strokeLinecap="round"/>
                    <circle cx="12" cy="16" r="1.5" fill="#26a676"/>
                  </svg>
                </div>

                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff', margin: '0 0 6px' }}>
                  {title}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', margin: 0, lineHeight: '1.55' }}>
                  {description}
                </p>
              </div>

              {/* ── Form body ── */}
              <div style={{ padding: '24px 28px 28px' }}>

                {/* Email pill */}
                {email && (
                  <div style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          '10px',
                    background:   '#f4faf7',
                    border:       '1.5px solid #d1ece0',
                    borderRadius: '12px',
                    padding:      '10px 14px',
                    marginBottom: '20px',
                  }}>
                    <div style={{
                      width:          '32px',
                      height:         '32px',
                      borderRadius:   '8px',
                      background:     '#e0f5ec',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      flexShrink:     0,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="5" width="18" height="14" rx="2" stroke="#26a676" strokeWidth="1.8"/>
                        <path d="M3 8l9 6 9-6" stroke="#26a676" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#9ab8a9', marginBottom: '1px', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Account</div>
                      <div style={{ fontSize: '13px', color: '#0c1c14', fontWeight: '600' }}>{email}</div>
                    </div>
                  </div>
                )}

                {/* Reason textarea */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display:      'block',
                    fontSize:     '12px',
                    fontWeight:   '700',
                    color:        '#3a5248',
                    marginBottom: '8px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}>
                    {label}
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => onReasonChange(e.target.value)}
                    placeholder={placeholder}
                    rows={4}
                    maxLength={1000}
                    style={{
                      width:        '100%',
                      borderRadius: '12px',
                      border:       '1.5px solid #e3ede8',
                      padding:      '12px 14px',
                      fontSize:     '14px',
                      color:        '#0c1c14',
                      background:   '#f8fbf9',
                      outline:      'none',
                      resize:       'vertical',
                      fontFamily:   'inherit',
                      lineHeight:   '1.6',
                      boxSizing:    'border-box',
                      transition:   'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#26a676';
                      e.target.style.boxShadow   = '0 0 0 3px rgba(38,166,118,0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e3ede8';
                      e.target.style.boxShadow   = 'none';
                    }}
                    disabled={loading}
                  />
                  <div style={{
                    display:        'flex',
                    justifyContent: 'space-between',
                    marginTop:      '6px',
                    fontSize:       '12px',
                  }}>
                    <span style={{ color: reason.trim().length < minLength ? '#f59e0b' : '#26a676', fontWeight: '500' }}>
                      {reason.trim().length < minLength
                        ? `${minLength - reason.trim().length} more characters needed`
                        : '✓ Looks good'}
                    </span>
                    <span style={{ color: '#9ab8a9' }}>{reason.length}/1000</span>
                  </div>
                </div>

                {/* Buttons */}
                <button
                  type="button"
                  className="lp-btn"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  style={{ width: '100%', marginBottom: '10px' }}
                >
                  {loading ? 'Submitting…' : submitLabel}
                </button>
                <button
                  type="button"
                  className="lp-link"
                  onClick={onClose}
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes recovery-in {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </>
  );
}