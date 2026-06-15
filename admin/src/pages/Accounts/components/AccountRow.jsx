const ROLE_MAP = {
  admin:       { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd', label: 'Admin' },
  client:      { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'Business' },
  team_leader: { bg: '#f0fdf4', color: '#15803d', border: '#86efac', label: 'Team Leader' },
  staff:       { bg: '#f9fafb', color: '#374151', border: '#e5e7eb', label: 'Staff' },
};

function RoleBadge({ role, type }) {
  const s = ROLE_MAP[type === 'staff' ? 'staff' : role] || ROLE_MAP.client;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

function StatusBadge({ account }) {
  const tempLocked = account.pinLockedUntil && new Date(account.pinLockedUntil) > new Date();
  if (account.pinPermanentlyLocked)
    return <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Perm. Locked</span>;
  if (tempLocked)
    return <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Temp. Locked</span>;
  if (account.pinAttempts > 0)
    return <span style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{account.pinAttempts} Attempt{account.pinAttempts !== 1 ? 's' : ''}</span>;
  return <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Active</span>;
}

export default function AccountRow({ account, onDetails, onArchive, isLast }) {
  const tempLocked     = account.pinLockedUntil && new Date(account.pinLockedUntil) > new Date();
  const needsAttention = account.pinPermanentlyLocked || tempLocked;
  const initials       = (account.name || account.email || '?')[0].toUpperCase();

  return (
    <tr
      style={{
        borderBottom: isLast ? 'none' : '1px solid #f7f8fa',
        background:   needsAttention ? 'rgba(254,242,242,0.45)' : 'transparent',
        borderLeft:   needsAttention ? '3px solid #fca5a5' : '3px solid transparent',
        transition:   'background 0.1s',
      }}
      onMouseEnter={e => { if (!needsAttention) e.currentTarget.style.background = '#fafbff'; }}
      onMouseLeave={e => { if (!needsAttention) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Account */}
      <td style={{ padding: '11px 16px 11px 20px', minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#059669', flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827' }}>{account.name || '—'}</div>
            <div style={{ fontSize: '0.74rem', color: '#9ca3af', marginTop: 1 }}>{account.email}</div>
          </div>
        </div>
      </td>

      {/* Role */}
      <td style={{ padding: '11px 16px' }}>
        <RoleBadge role={account.role} type={account.accountType} />
      </td>

      {/* Status */}
      <td style={{ padding: '11px 16px' }}>
        <StatusBadge account={account} />
      </td>

      {/* Actions */}
      <td style={{ padding: '11px 16px', whiteSpace: 'nowrap', textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onDetails(account)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, border: '1px solid #e0e7ff', background: '#eef2ff', fontSize: '0.76rem', fontWeight: 600, color: '#4f46e5', cursor: 'pointer', transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#e0e7ff'}
            onMouseLeave={e => e.currentTarget.style.background = '#eef2ff'}
          >
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="10" cy="10" r="8"/>
              <path d="M10 9v5M10 7h.01" strokeLinecap="round"/>
            </svg>
            Details
          </button>
          <button
            onClick={() => onArchive(account)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, border: '1px solid #fde68a', background: '#fffbeb', fontSize: '0.76rem', fontWeight: 600, color: '#92400e', cursor: 'pointer', transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef3c7'}
            onMouseLeave={e => e.currentTarget.style.background = '#fffbeb'}
          >
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="6" width="16" height="11" rx="1.5"/>
              <path d="M2 6l2-3h12l2 3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 11h4" strokeLinecap="round"/>
            </svg>
            Archive
          </button>
        </div>
      </td>
    </tr>
  );
}
