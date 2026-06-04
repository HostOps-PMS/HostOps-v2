export default function TopBar({ onAction }) {
  const currentUser = (() => {
    try { return JSON.parse(sessionStorage.getItem('hp_user') || '{}'); } catch { return {}; }
  })();

  const fullName = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || 'User';
  const email = currentUser.email || '';
  const initials = [currentUser.firstName, currentUser.lastName]
    .filter(Boolean).map(n => n[0].toUpperCase()).join('') || 'U';
  const firstName = currentUser.firstName || 'there';

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '10px 24px',
      background: '#fff',
      borderBottom: '0.5px solid rgba(0,0,0,0.08)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      position: 'sticky',
      top: 0,
      zIndex: 100,
      minHeight: 60,
    }}>

      {/* Left — Welcome */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111', letterSpacing: '-0.01em' }}>
          Welcome back, {firstName}! 👋
        </div>
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>
          Get a clear view of your real estate portfolio.
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right — Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>

        {/* Add Property button */}
        <button
          onClick={onAction}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: '#1a9e6e',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 1v10M1 6h10" strokeLinecap="round" />
          </svg>
          Add Property
        </button>

        {/* Notification bell */}
        <button style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: '#f7f7f7',
          border: '0.5px solid rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#888',
          position: 'relative',
        }} title="Notifications">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M10 2a6 6 0 00-6 6v3l-1.5 2H17.5L16 11V8a6 6 0 00-6-6z" />
            <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round" />
          </svg>
        </button> 

        {/* Avatar only */}
        <div style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: '#1a9e6e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
          cursor: 'pointer',
          flexShrink: 0,
        }} title={fullName}>
          {initials}
        </div>

      </div>
    </header>
  );
}