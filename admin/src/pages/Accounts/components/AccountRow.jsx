import { fmt } from '../hooks/useAccounts';

const ROLE_MAP = {
  admin:       { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd', label: 'Admin' },
  client:      { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'Business' },
  team_leader: { bg: '#f0fdf4', color: '#15803d', border: '#86efac', label: 'Team Leader' },
  staff:       { bg: '#f9fafb', color: '#374151', border: '#e5e7eb', label: 'Staff' },
};

function RoleBadge({ role, type }) {
  const s = ROLE_MAP[type === 'staff' ? 'staff' : role] || ROLE_MAP.client;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

function PinBadge({ attempts, permanentlyLocked, lockedUntil }) {
  const tempLocked = lockedUntil && new Date(lockedUntil) > new Date();
  if (permanentlyLocked) return <span className="badge badge--red">Perm. Locked</span>;
  if (tempLocked)        return <span className="badge badge--yellow">Temp. Locked</span>;
  if (attempts > 0)      return <span className="badge badge--orange">{attempts} attempt{attempts !== 1 ? 's' : ''}</span>;
  return                        <span className="badge badge--green">OK</span>;
}

export default function AccountRow({ account, onUnlock, isLast }) {
  const tempLocked     = account.pinLockedUntil && new Date(account.pinLockedUntil) > new Date();
  const needsAttention = account.pinPermanentlyLocked || tempLocked;

  return (
    <tr
      style={{
        borderBottom: isLast ? 'none' : '1px solid #f7f8fa',
        background:   needsAttention ? 'rgba(254,242,242,0.5)' : 'transparent',
        borderLeft:   needsAttention ? '3px solid #fca5a5' : '3px solid transparent',
        transition:   'background 0.1s', cursor: 'default',
      }}
      onMouseEnter={e => { if (!needsAttention) e.currentTarget.style.background = '#fafbff'; }}
      onMouseLeave={e => { if (!needsAttention) e.currentTarget.style.background = 'transparent'; }}
    >
      <td style={{ padding: '12px 16px 12px 20px', minWidth: 160 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#059669', flexShrink: 0 }}>
            {(account.name || account.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{account.name || '—'}</div>
            <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>{account.email}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <RoleBadge role={account.role} type={account.accountType} />
      </td>
      <td style={{ padding: '12px 16px' }}>
        <PinBadge attempts={account.pinAttempts} permanentlyLocked={account.pinPermanentlyLocked} lockedUntil={account.pinLockedUntil} />
      </td>
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        <span style={{ fontSize: '0.83rem', fontWeight: 700, color: account.pinAttempts > 0 ? '#ea580c' : '#374151' }}>
          {account.pinAttempts ?? 0}
        </span>
      </td>
      <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{fmt(account.pinLockedUntil)}</td>
      <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{fmt(account.lastLoginAt)}</td>
      <td style={{ padding: '12px 16px 12px 8px', whiteSpace: 'nowrap' }}>
        {(account.pinPermanentlyLocked || account.pinAttempts > 0 || tempLocked) && (
          <button
            onClick={() => onUnlock(account)}
            style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #d1fae5', background: '#f0fdf4', fontSize: '0.78rem', fontWeight: 600, color: '#16a34a', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'}
            onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}
          >
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="9" width="14" height="10" rx="2" /><path d="M7 9V6a3 3 0 016 0v3" strokeLinecap="round" />
            </svg>
            Unlock
          </button>
        )}
      </td>
    </tr>
  );
}
