import { useTheme } from '../../../context/ThemeContext';

export default function DeleteConfirmModal({ name, onConfirm, onClose, loading }) {
  const { dark } = useTheme();

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10,20,15,0.5)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'dcm-fade 0.18s ease',
      }}
      onClick={e => e.target === e.currentTarget && !loading && onClose()}
    >
      <style>{`
        @keyframes dcm-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dcm-in   { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>

      <div style={{
        background: dark ? '#132a1e' : '#fff',
        borderRadius: 18,
        width: 380, maxWidth: '92vw',
        boxShadow: '0 24px 64px rgba(0,0,0,0.20), 0 4px 16px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        animation: 'dcm-in 0.2s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg, #ef4444, #f87171)' }} />

        <div style={{ padding: '28px 28px 24px', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: dark ? '#1a0a0a' : '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
          }}>
            <svg width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="#dc2626" strokeWidth="1.7">
              <path d="M4 6h12M8 6V4h4v2M6 6v10a1 1 0 001 1h6a1 1 0 001-1V6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 800, color: dark ? '#eaf5f0' : '#111827', letterSpacing: '-0.01em' }}>
            Delete Announcement
          </h3>

          <p style={{ margin: '0 0 16px', fontSize: '0.875rem', color: dark ? '#7ab89a' : '#4b5563', lineHeight: 1.6 }}>
            Delete <strong style={{ color: dark ? '#eaf5f0' : '#111827' }}>{name}</strong>? This action cannot be undone.
          </p>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '8px 14px', borderRadius: 10,
            background: dark ? '#1a0a0a' : '#fef2f2',
            border: `1px solid ${dark ? '#7f1d1d' : '#fecaca'}`,
            fontSize: '0.78rem', fontWeight: 600,
            color: dark ? '#f87171' : '#991b1b',
          }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="10" cy="10" r="8"/><path d="M10 7v4M10 13h.01" strokeLinecap="round"/>
            </svg>
            This will permanently remove the announcement.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '0 28px 24px' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              border: `1.5px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`, background: dark ? 'transparent' : '#fff',
              color: dark ? '#7ab89a' : '#374151', fontWeight: 600, fontSize: '0.875rem',
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.12s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = dark ? '#0d2619' : '#f9fafb'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = dark ? 'transparent' : '#fff'; }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              border: 'none', background: loading ? '#f87171' : '#ef4444',
              color: '#fff', fontWeight: 600, fontSize: '0.875rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.12s', opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#dc2626'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#ef4444'; }}
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
