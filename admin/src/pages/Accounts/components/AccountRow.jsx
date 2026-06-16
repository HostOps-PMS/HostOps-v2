import { useTheme } from '../../../context/ThemeContext';

const ROLE_MAP = {
  admin:       { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd', label: 'Admin' },
  client:      { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'Business' },
  team_leader: { bg: '#f0fdf4', color: '#15803d', border: '#86efac', label: 'Team Leader' },
  staff:       { bg: '#f9fafb', color: '#374151', border: '#e5e7eb', label: 'Staff' },
};

function RoleBadge({ role, type }) {
  const { dark } = useTheme();
  const s = ROLE_MAP[type === 'staff' ? 'staff' : role] || ROLE_MAP.client;
  return (
    <span style={{ background: dark ? '#0d2619' : s.bg, color: dark ? '#7ab89a' : s.color, border: `1px solid ${dark ? '#1e3a2a' : s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

function StatusBadge({ account }) {
  const { dark } = useTheme();
  const tempLocked = account.pinLockedUntil && new Date(account.pinLockedUntil) > new Date();
  if (account.pinPermanentlyLocked)
    return <span style={{ background: dark ? '#2a0d0d' : '#fef2f2', color: '#dc2626', border: `1px solid ${dark ? '#5c1a1a' : '#fecaca'}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Perm. Locked</span>;
  if (tempLocked)
    return <span style={{ background: dark ? '#2a1f00' : '#fffbeb', color: '#d97706', border: `1px solid ${dark ? '#5c4400' : '#fde68a'}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Temp. Locked</span>;
  if (account.pinAttempts > 0)
    return <span style={{ background: dark ? '#2a1500' : '#fff7ed', color: '#ea580c', border: `1px solid ${dark ? '#5c2e00' : '#fed7aa'}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{account.pinAttempts} Attempt{account.pinAttempts !== 1 ? 's' : ''}</span>;
  return <span style={{ background: dark ? '#0d2619' : '#f0fdf4', color: dark ? '#4ade80' : '#16a34a', border: `1px solid ${dark ? '#1e3a2a' : '#bbf7d0'}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Active</span>;
}

export default function AccountRow({ account, onDetails, onArchive, isLast }) {
  const { dark } = useTheme();
  const tempLocked     = account.pinLockedUntil && new Date(account.pinLockedUntil) > new Date();
  const needsAttention = account.pinPermanentlyLocked || tempLocked;
  const initials       = (account.name || account.email || '?')[0].toUpperCase();

  return (
    <tr
      style={{
        borderBottom: isLast ? 'none' : `1px solid ${dark ? '#1e3a2a' : '#f7f8fa'}`,
        background:   needsAttention ? (dark ? 'rgba(90,20,20,0.35)' : 'rgba(254,242,242,0.45)') : 'transparent',
        borderLeft:   needsAttention ? '3px solid #fca5a5' : '3px solid transparent',
        transition:   'background 0.1s',
      }}
      onMouseEnter={e => { if (!needsAttention) e.currentTarget.style.background = dark ? '#0d2619' : '#fafbff'; }}
      onMouseLeave={e => { if (!needsAttention) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Account */}
      <td style={{ padding: '11px 16px 11px 20px', minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: dark ? '#0d2619' : '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: dark ? '#4ade80' : '#059669', flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: dark ? '#eaf5f0' : '#111827' }}>{account.name || '—'}</div>
            <div style={{ fontSize: '0.74rem', color: dark ? '#4d8a6a' : '#9ca3af', marginTop: 1 }}>{account.email}</div>
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, border: `1px solid ${dark ? '#1e3a2a' : '#e0e7ff'}`, background: dark ? '#0d2619' : '#eef2ff', fontSize: '0.76rem', fontWeight: 600, color: dark ? '#7ab89a' : '#4f46e5', cursor: 'pointer', transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = dark ? '#132a1e' : '#e0e7ff'}
            onMouseLeave={e => e.currentTarget.style.background = dark ? '#0d2619' : '#eef2ff'}
          >
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="10" cy="10" r="8"/>
              <path d="M10 9v5M10 7h.01" strokeLinecap="round"/>
            </svg>
            Details
          </button>
          <button
            onClick={() => onArchive(account)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, border: `1px solid ${dark ? '#5c4400' : '#fde68a'}`, background: dark ? '#2a1f00' : '#fffbeb', fontSize: '0.76rem', fontWeight: 600, color: dark ? '#fbbf24' : '#92400e', cursor: 'pointer', transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = dark ? '#3a2a00' : '#fef3c7'}
            onMouseLeave={e => e.currentTarget.style.background = dark ? '#2a1f00' : '#fffbeb'}
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
