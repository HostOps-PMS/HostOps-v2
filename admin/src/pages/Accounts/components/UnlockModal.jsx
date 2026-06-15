import { useState, useEffect } from 'react';
import { fmt, fetchRecoveryRequest, unlockAccount } from '../hooks/useAccounts';
import { toast } from '../utils/toast';

const ROLE_MAP = {
  admin:       { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd', label: 'Admin' },
  client:      { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'Business' },
  team_leader: { bg: '#f0fdf4', color: '#15803d', border: '#86efac', label: 'Team Leader' },
  staff:       { bg: '#f9fafb', color: '#374151', border: '#e5e7eb', label: 'Staff' },
};

export default function UnlockModal({ account, onClose, onUnlocked }) {
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(true);
  const [recoveryRequest, setRecoveryRequest] = useState(null);

  useEffect(() => {
    fetchRecoveryRequest(account.email)
      .then(data => setRecoveryRequest(data.found ? data.request : null))
      .catch(() => setRecoveryRequest(null))
      .finally(() => setRecoveryLoading(false));
  }, [account.email]);

  const canUnlock = !recoveryLoading && recoveryRequest !== null;

  async function handleUnlock() {
    if (!canUnlock || loading) return;
    setLoading(true);
    setError('');
    try {
      await unlockAccount({ email: account.email, accountType: account.accountType });
      toast.success(`PIN unlocked for ${account.name || account.email}.`, { title: 'PIN Unlocked' });
      onUnlocked();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const s = ROLE_MAP[account.accountType === 'staff' ? 'staff' : account.role] || ROLE_MAP.client;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(12,28,20,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 20, maxWidth: 460, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '28px 32px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0d1117', lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em' }}>
              Unlock <span style={{ color: '#26a676' }}>PIN</span>
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '.8125rem', color: '#9ca3af' }}>Review the recovery request before unlocking.</p>
          </div>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280', flexShrink: 0, marginTop: 2 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 32px 0' }}>
          {/* Profile card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: '#f8faf9', border: '1px solid #e5efe9', marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #26a676, #1d8a62)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.95rem', flexShrink: 0 }}>
              {(account.name || account.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0d1117' }}>{account.name || '—'}</div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 1 }}>{account.email}</div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{s.label}</span>
            </div>
          </div>

          <p style={{ fontSize: '.8125rem', color: '#6b7280', lineHeight: 1.6, margin: '0 0 16px' }}>
            This will reset <strong>pinAttempts</strong> to 0, clear <strong>pinLockedUntil</strong>, and set <strong>pinPermanentlyLocked</strong> to false.
          </p>

          {/* Recovery request box */}
          <div style={{ background: recoveryLoading ? '#f9fafb' : (recoveryRequest ? '#f9fafb' : '#fef9f0'), border: `1px solid ${recoveryLoading ? '#e5e7eb' : (recoveryRequest ? '#e5e7eb' : '#fde68a')}`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (recoveryLoading || recoveryRequest) ? 10 : 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recovery Request</span>
              {recoveryRequest && !recoveryLoading && (
                <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>⏳ Pending</span>
              )}
            </div>

            {recoveryLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', fontSize: 12 }}>
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                  <path d="M4 4a8 8 0 0112 0M16 16a8 8 0 01-12 0" strokeLinecap="round" />
                </svg>
                Checking for recovery request…
              </div>
            ) : recoveryRequest ? (
              <div>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 8, fontStyle: 'italic' }}>
                  "{recoveryRequest.reason}"
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#9ca3af' }}>
                  <span>Submitted: {fmt(recoveryRequest.createdAt)}</span>
                  <span>Type: {recoveryRequest.accountType}</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 2 }}>No pending recovery request</div>
                  <div style={{ fontSize: 12, color: '#a16207', lineHeight: 1.5 }}>The account must submit a recovery request before it can be unlocked.</div>
                </div>
              </div>
            )}
          </div>

          {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: '.8125rem', fontWeight: 500, marginBottom: 16 }}>⚠️ {error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 32px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #f0f2f5', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '9px 22px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: '0.875rem', fontWeight: 600, color: '#374151', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleUnlock} disabled={!canUnlock || loading} title={!canUnlock && !recoveryLoading ? 'Waiting for user to submit a recovery request' : ''}
            style={{ padding: '9px 26px', borderRadius: 10, border: 'none', background: (!canUnlock || loading) ? '#9ca3af' : '#0d1117', color: '#fff', fontSize: '0.875rem', fontWeight: 700, cursor: (!canUnlock || loading) ? 'not-allowed' : 'pointer', boxShadow: (!canUnlock || loading) ? 'none' : '0 2px 8px rgba(13,17,23,0.18)', transition: 'background 0.15s' }}>
            {loading ? 'Unlocking…' : 'Unlock Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
