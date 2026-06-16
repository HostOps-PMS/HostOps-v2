import { useTheme } from '../../context/ThemeContext';

export default function ArchiveConfirmModal({ mode = 'archive', name, onConfirm, onClose, loading }) {
  const { dark } = useTheme();
  const isArchive = mode === 'archive';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10,20,15,0.5)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'acm-fade 0.18s ease',
      }}
      onClick={e => e.target === e.currentTarget && !loading && onClose()}
    >
      <style>{`
        @keyframes acm-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes acm-in   { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>

      <div style={{
        background: dark ? '#132a1e' : '#fff',
        borderRadius: 18,
        width: 380, maxWidth: '92vw',
        boxShadow: '0 24px 64px rgba(0,0,0,0.20), 0 4px 16px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        animation: 'acm-in 0.2s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Colored top strip */}
        <div style={{
          height: 4,
          background: isArchive
            ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
            : 'linear-gradient(90deg, #10b981, #34d399)',
        }} />

        {/* Body */}
        <div style={{ padding: '28px 28px 24px', textAlign: 'center' }}>

          {/* Icon */}
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: isArchive ? (dark ? '#2a1f00' : '#fef3c7') : (dark ? '#052e16' : '#d1fae5'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
          }}>
            {isArchive ? (
              <svg width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="#d97706" strokeWidth="1.7">
                <rect x="2" y="6" width="16" height="11" rx="1.5"/>
                <path d="M2 6l2-3h12l2 3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 11h4" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="#059669" strokeWidth="1.7">
                <rect x="2" y="6" width="16" height="11" rx="1.5"/>
                <path d="M2 6l2-3h12l2 3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 11h4M10 9v4" strokeLinecap="round"/>
              </svg>
            )}
          </div>

          <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 800, color: dark ? '#eaf5f0' : '#111827', letterSpacing: '-0.01em' }}>
            {isArchive ? 'Archive Account' : 'Restore Account'}
          </h3>

          <p style={{ margin: '0 0 16px', fontSize: '0.875rem', color: dark ? '#7ab89a' : '#4b5563', lineHeight: 1.6 }}>
            {isArchive
              ? <>Archive <strong style={{ color: dark ? '#eaf5f0' : '#111827' }}>{name}</strong>? This will archive the account.</>
              : <>Restore <strong style={{ color: dark ? '#eaf5f0' : '#111827' }}>{name}</strong>? They will be able to log in again.</>
            }
          </p>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '8px 14px',
            borderRadius: 10,
            background: isArchive ? (dark ? '#1a1200' : '#fffbeb') : (dark ? '#052e16' : '#f0fdf4'),
            border: `1px solid ${isArchive ? (dark ? '#3d2e00' : '#fde68a') : (dark ? '#166534' : '#bbf7d0')}`,
            fontSize: '0.78rem', fontWeight: 600,
            color: isArchive ? (dark ? '#fbbf24' : '#92400e') : (dark ? '#4ade80' : '#065f46'),
          }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              {isArchive
                ? <><circle cx="10" cy="10" r="8"/><path d="M10 7v4M10 13h.01" strokeLinecap="round"/></>
                : <><circle cx="10" cy="10" r="8"/><path d="M6.5 10.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round"/></>
              }
            </svg>
            {isArchive
              ? 'This will block the account from logging in.'
              : 'This will re-enable login access.'
            }
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 10, padding: '0 28px 24px',
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              border: `1.5px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`, background: dark ? 'transparent' : '#fff',
              color: dark ? '#7ab89a' : '#374151', fontWeight: 600, fontSize: '0.875rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = dark ? '#0d2619' : '#f9fafb'; }}
            onMouseLeave={e => e.currentTarget.style.background = dark ? 'transparent' : '#fff'}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
              background: loading
                ? '#9ca3af'
                : isArchive
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff', fontWeight: 700, fontSize: '0.875rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : isArchive ? '0 2px 10px rgba(245,158,11,0.30)' : '0 2px 10px rgba(16,185,129,0.30)',
              transition: 'opacity 0.12s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            {loading
              ? (isArchive ? 'Archiving…' : 'Restoring…')
              : (isArchive ? 'Archive' : 'Restore')
            }
          </button>
        </div>
      </div>
    </div>
  );
}
