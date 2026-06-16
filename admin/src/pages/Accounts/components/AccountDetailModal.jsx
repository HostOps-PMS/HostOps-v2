import { fmt } from '../hooks/useAccounts';
import { useTheme } from '../../../context/ThemeContext';

const ROLE_MAP = {
  admin:       { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd', label: 'Admin' },
  client:      { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'Business' },
  team_leader: { bg: '#f0fdf4', color: '#15803d', border: '#86efac', label: 'Team Leader' },
  staff:       { bg: '#f9fafb', color: '#374151', border: '#e5e7eb', label: 'Staff' },
};

function RoleBadge({ role, accountType }) {
  const key = accountType === 'staff' ? (role === 'team_leader' ? 'team_leader' : 'staff') : role;
  const s = ROLE_MAP[key] || ROLE_MAP.client;
  return (
    <span style={{ display: 'inline-block', background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 10px', fontSize: 11.5, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

function StatusBadge({ account }) {
  const tempLocked = account.pinLockedUntil && new Date(account.pinLockedUntil) > new Date();
  if (account.pinPermanentlyLocked)
    return <span style={{ display: 'inline-block', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 10px', fontSize: 11.5, fontWeight: 700 }}>Perm. Locked</span>;
  if (tempLocked)
    return <span style={{ display: 'inline-block', background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 10px', fontSize: 11.5, fontWeight: 700 }}>Temp. Locked</span>;
  if (account.pinAttempts > 0)
    return <span style={{ display: 'inline-block', background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', borderRadius: 6, padding: '2px 10px', fontSize: 11.5, fontWeight: 700 }}>{account.pinAttempts} Attempt{account.pinAttempts !== 1 ? 's' : ''}</span>;
  return <span style={{ display: 'inline-block', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 10px', fontSize: 11.5, fontWeight: 700 }}>Active</span>;
}

function Field({ label, children, dark }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: '.75rem', fontWeight: 600, color: dark ? '#7ab89a' : '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 10 }}>
        {label}
      </span>
      <span style={{ fontSize: '.875rem', fontWeight: 500, color: dark ? '#eaf5f0' : '#0d1117' }}>
        {children ?? '—'}
      </span>
    </div>
  );
}

function Divider({ label, dark }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 2px' }}>
      <div style={{ flex: 1, height: 1, background: dark ? '#1e3a2a' : '#e5e9ec' }} />
      <span style={{ fontSize: '.6875rem', fontWeight: 600, letterSpacing: '.06em', color: dark ? '#4d8a6a' : '#9ca3af', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: dark ? '#1e3a2a' : '#e5e9ec' }} />
    </div>
  );
}

export default function AccountDetailModal({ account, onClose, onUnlock }) {
  const { dark } = useTheme();
  const tempLocked  = account.pinLockedUntil && new Date(account.pinLockedUntil) > new Date();
  const needsUnlock = account.pinPermanentlyLocked || tempLocked || account.pinAttempts > 0;
  const initial     = (account.name || account.email || '?')[0].toUpperCase();

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: dark ? 'rgba(0,0,0,0.65)' : 'rgba(12,28,20,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`@keyframes adm-in { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <div style={{
        background: dark ? '#132a1e' : '#fff', borderRadius: 20,
        width: 480, maxWidth: '95vw', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.18), 0 4px 20px rgba(0,0,0,0.08)',
        animation: 'adm-in 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '28px 32px 0 32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: dark ? '#eaf5f0' : '#0d1117', lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em' }}>
              Account <span style={{ color: '#26a676' }}>Details</span>
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '.8125rem', color: dark ? '#4d8a6a' : '#9ca3af', fontWeight: 400 }}>
              Review account and PIN security information.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: dark ? '#0d2619' : '#f3f4f6', border: `1px solid ${dark ? '#1e3a2a' : 'transparent'}`, borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: dark ? '#4d8a6a' : '#6b7280', fontSize: '1rem', flexShrink: 0, marginTop: 2, transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = dark ? '#132a1e' : '#e5e7eb'}
            onMouseLeave={e => e.currentTarget.style.background = dark ? '#0d2619' : '#f3f4f6'}
          >✕</button>
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 32px 8px' }}>

          {/* Profile card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: dark ? '#0d2619' : '#f8faf9', border: `1px solid ${dark ? '#1e3a2a' : '#e5efe9'}`, marginBottom: 4 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #26a676, #1d8a62)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '0.95rem',
            }}>
              {initial}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: dark ? '#eaf5f0' : '#0d1117' }}>{account.name || '—'}</div>
              <div style={{ fontSize: '0.78rem', color: dark ? '#4d8a6a' : '#9ca3af', marginTop: 1 }}>{account.email}</div>
            </div>
          </div>

          {/* Account fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field dark={dark} label="Role">
              <RoleBadge role={account.role} accountType={account.accountType} />
            </Field>
            <Field dark={dark} label="Status">
              <StatusBadge account={account} />
            </Field>
            <Field dark={dark} label="Last Login">
              {fmt(account.lastLoginAt)}
            </Field>
            <Field dark={dark} label="Joined">
              {fmt(account.createdAt)}
            </Field>
          </div>

          {/* PIN Security section */}
          <Divider dark={dark} label="PIN Security" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, paddingBottom: 12 }}>
            <Field dark={dark} label="Failed Attempts">
              <span style={{ fontWeight: 700, color: account.pinAttempts > 0 ? '#ea580c' : (dark ? '#eaf5f0' : '#0d1117') }}>
                {account.pinAttempts ?? 0}
              </span>
            </Field>
            <Field dark={dark} label="Locked Until">
              {fmt(account.pinLockedUntil)}
            </Field>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '16px 32px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}`, background: dark ? '#132a1e' : '#fff', flexShrink: 0 }}>
          {needsUnlock && (
            <button
              onClick={() => { onUnlock(account); onClose(); }}
              style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: '#16a34a', fontSize: '0.875rem', fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(22,163,74,0.25)', transition: 'background 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#15803d'}
              onMouseLeave={e => e.currentTarget.style.background = '#16a34a'}
            >
              Unlock PIN
            </button>
          )}
          <button
            onClick={onClose}
            style={{ padding: '9px 22px', borderRadius: 10, border: `1.5px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`, background: dark ? 'transparent' : '#fff', fontSize: '0.875rem', fontWeight: 600, color: dark ? '#7ab89a' : '#374151', cursor: 'pointer', transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = dark ? '#0d2619' : '#f9fafb'}
            onMouseLeave={e => e.currentTarget.style.background = dark ? 'transparent' : '#fff'}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
