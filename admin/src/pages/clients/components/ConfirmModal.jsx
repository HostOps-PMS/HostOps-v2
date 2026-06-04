export default function ConfirmModal({
  title          = 'Confirm',
  message        = 'Are you sure?',
  confirmLabel   = 'Confirm',
  cancelLabel    = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}) {
  const isDanger = confirmVariant === 'danger';
 
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onCancel?.()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(12,28,20,.5)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        animation: 'db-fade-in 120ms ease forwards',
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 14,
          width: 340,
          maxWidth: 'calc(100vw - 32px)',
          boxShadow: '0 8px 32px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06)',
          animation: 'db-slide-up 180ms cubic-bezier(.22,.68,0,1.2) forwards',
          overflow: 'hidden',
        }}
      >
        {/* ── Content ── */}
        <div style={{ padding: '22px 22px 18px' }}>
 
          {/* Icon + close row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            {/* Icon pill */}
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: isDanger ? '#fee2e2' : 'var(--color-brand-light, #e0f4ed)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}>
              {isDanger ? (
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round">
                  <path d="M10 6v4M10 14h.01"/>
                  <path d="M8.29 3.29a2 2 0 013.42 0l6 10A2 2 0 0116 16H4a2 2 0 01-1.71-2.71l6-10z"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--color-brand, #26a676)" strokeWidth="2" strokeLinecap="round">
                  <circle cx="10" cy="10" r="8"/>
                  <path d="M10 6v4M10 14h.01"/>
                </svg>
              )}
            </div>
 
            {/* Close button */}
            <button
              onClick={onCancel}
              style={{
                width: 24,
                height: 24,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--color-muted)',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 6,
                padding: 0,
                transition: 'background .12s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l12 12M14 2L2 14"/>
              </svg>
            </button>
          </div>
 
          {/* Title */}
          <p style={{
            margin: '0 0 6px',
            fontSize: '.9375rem',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text)',
            letterSpacing: '-.01em',
            lineHeight: 1.3,
          }}>
            {title}
          </p>
 
          {/* Message */}
          <p style={{
            margin: 0,
            fontSize: '.8125rem',
            color: 'var(--color-muted)',
            lineHeight: 1.55,
          }}>
            {message}
          </p>
        </div>
 
        {/* ── Actions ── */}
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '0 22px 18px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onCancel}
            style={{
              height: 32,
              padding: '0 14px',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: '.8125rem',
              fontWeight: 500,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              transition: 'background .12s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
          >
            {cancelLabel}
          </button>
 
          <button
            onClick={onConfirm}
            style={{
              height: 32,
              padding: '0 14px',
              border: 'none',
              borderRadius: 8,
              background: isDanger ? '#ef4444' : 'var(--color-brand, #26a676)',
              color: '#fff',
              fontSize: '.8125rem',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              transition: 'opacity .12s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '.88'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}