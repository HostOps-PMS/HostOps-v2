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
          background:     'rgba(0, 0, 0, 0.45)',
          zIndex:         1000,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '16px',
          backdropFilter: 'blur(2px)',
        }}
      >
        {/* ── Modal card — stop propagation so clicks inside don't close ── */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background:   '#ffffff',
            borderRadius: '20px',
            padding:      '32px 28px 28px',
            width:        '100%',
            maxWidth:     '420px',
            boxShadow:    '0 20px 60px rgba(0,0,0,0.18)',
            position:     'relative',
            animation:    'recovery-in 0.22s ease',
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position:   'absolute',
              top:        '16px',
              right:      '16px',
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              fontSize:   '20px',
              color:      '#9ab8a9',
              lineHeight: 1,
              padding:    '4px',
            }}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          {submitted ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width:          '52px',
                height:         '52px',
                borderRadius:   '50%',
                background:     '#eaf8f1',
                border:         '1.5px solid #26a676',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                margin:         '0 auto 16px',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#26a676" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0c1c14', margin: '0 0 10px' }}>
                Request Submitted
              </h2>
              <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px' }}>
                Your request has been sent. An administrator will review it and contact you shortly.
              </p>
              <button
                type="button"
                className="lp-btn"
                onClick={onClose}
                style={{ width: '100%' }}
              >
                Close
              </button>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0c1c14', margin: '0 0 6px' }}>
                {title}
              </h2>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 20px', lineHeight: '1.5' }}>
                {description}
              </p>

              {/* Email display (read-only) */}
              {email && (
                <div style={{
                  background:   '#f8fbf9',
                  border:       '1.5px solid #e3ede8',
                  borderRadius: '10px',
                  padding:      '10px 14px',
                  marginBottom: '16px',
                  fontSize:     '13px',
                  color:        '#3a5248',
                }}>
                  <span style={{ color: '#9ab8a9', fontSize: '12px', display: 'block', marginBottom: '2px' }}>
                    Account email
                  </span>
                  <strong>{email}</strong>
                </div>
              )}

              {/* Reason textarea */}
              <div style={{ marginBottom: '20px' }}>
                <label className="lp-label" style={{ display: 'block', marginBottom: '6px' }}>
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
                    lineHeight:   '1.5',
                    boxSizing:    'border-box',
                    transition:   'border-color 0.15s ease',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#26a676'; }}
                  onBlur={(e)  => { e.target.style.borderColor = '#e3ede8'; }}
                  disabled={loading}
                />
                <div style={{
                  display:        'flex',
                  justifyContent: 'space-between',
                  marginTop:      '4px',
                  fontSize:       '12px',
                  color:          '#9ab8a9',
                }}>
                  <span>
                    {reason.trim().length < minLength ? `At least ${minLength} characters required` : ''}
                  </span>
                  <span>{reason.length}/1000</span>
                </div>
              </div>

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
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes recovery-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </>
  );
}
