export default function ArchiveConfirmModal({ mode = 'archive', name, onConfirm, onClose, loading }) {
  const isArchive = mode === 'archive';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(12,28,20,0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28,
        maxWidth: 400, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 12,
          background: isArchive ? '#fef3c7' : '#f0fdf4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          {isArchive ? (
            <svg width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="#d97706" strokeWidth="1.8">
              <rect x="2" y="6" width="16" height="11" rx="1.5"/>
              <path d="M2 6l2-3h12l2 3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 11h4" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="#059669" strokeWidth="1.8">
              <rect x="2" y="6" width="16" height="11" rx="1.5"/>
              <path d="M2 6l2-3h12l2 3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 11h4M10 9v4" strokeLinecap="round"/>
            </svg>
          )}
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
          {isArchive ? 'Archive Account' : 'Restore Account'}
        </h3>

        <p style={{ margin: '0 0 6px', fontSize: '0.875rem', color: '#374151' }}>
          {isArchive
            ? <>Are you sure you want to archive <strong>{name}</strong>?</>
            : <>Restore <strong>{name}</strong> from archive?</>
          }
        </p>
        <p style={{
          margin: '0 0 24px', fontSize: '0.82rem',
          color: isArchive ? '#92400e' : '#065f46',
          background: isArchive ? '#fef3c7' : '#d1fae5',
          borderRadius: 8, padding: '8px 12px',
        }}>
          {isArchive
            ? 'This account will be blocked from logging in while archived.'
            : 'This account will be able to log in again.'
          }
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '9px 22px', borderRadius: 8,
              border: '1.5px solid #e2e8f0', background: '#fff',
              color: '#4a5568', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '9px 22px', borderRadius: 8, border: 'none',
              background: loading
                ? '#a0aec0'
                : isArchive ? '#d97706' : '#10b981',
              color: '#fff', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              transition: 'background 0.15s',
            }}
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
