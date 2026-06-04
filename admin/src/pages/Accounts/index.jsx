// src/pages/Accounts/index.jsx
// ─────────────────────────────────────────────────────────────────
// Admin-only page: shows all Users + Staffs in one view.
// Displays pinAttempts, pinPermanentlyLocked, pinLockedUntil.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import Sidebar from '../Sidebar';

const API     = import.meta.env.VITE_API_URL || 'https://hostpilot-smoobu.onrender.com';
const API_KEY = import.meta.env.VITE_API_KEY || '';

const token = () => sessionStorage.getItem('hp_access_token');

async function fetchJSON(path) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token()}`,
      'x-api-key':   API_KEY,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── Helpers ─────────────────────────────────────────────────────── */
function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function PinBadge({ attempts, permanentlyLocked, lockedUntil }) {
  const now = new Date();
  const tempLocked = lockedUntil && new Date(lockedUntil) > now;

  if (permanentlyLocked) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: '#fef2f2', color: '#dc2626',
        border: '1px solid #fecaca',
        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
      }}>
        <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        Perm. Locked
      </span>
    );
  }
  if (tempLocked) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: '#fffbeb', color: '#d97706',
        border: '1px solid #fde68a',
        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
      }}>
        <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        Temp. Locked
      </span>
    );
  }
  if (attempts > 0) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: '#fff7ed', color: '#ea580c',
        border: '1px solid #fed7aa',
        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
      }}>
        {attempts} attempt{attempts !== 1 ? 's' : ''}
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: '#f0fdf4', color: '#16a34a',
      border: '1px solid #bbf7d0',
      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
    }}>
      OK
    </span>
  );
}

function RoleBadge({ role, type }) {
  const map = {
    admin:       { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd', label: 'Admin' },
    client:      { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'Business' },
    team_leader: { bg: '#f0fdf4', color: '#15803d', border: '#86efac', label: 'Team Leader' },
    staff:       { bg: '#f9fafb', color: '#374151', border: '#e5e7eb', label: 'Staff' },
  };
  const s = map[type === 'staff' ? 'staff' : role] || map.client;
  return (
    <span style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
    }}>
      {s.label}
    </span>
  );
}

/* ── Unlock modal ─────────────────────────────────────────────────── */
function UnlockConfirmModal({ account, onClose, onUnlocked }) {
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(true);
  const [recoveryRequest, setRecoveryRequest] = useState(null); // only pending requests

  // Fetch PENDING recovery request for this account on modal open.
  // Resolved/dismissed requests are not returned by the backend —
  // they belong to a past lockout instance.
  useEffect(() => {
    async function loadRecovery() {
      setRecoveryLoading(true);
      try {
        const data = await fetchJSON(
          `/api/accounts/recovery-request?email=${encodeURIComponent(account.email)}`
        );
        setRecoveryRequest(data.found ? data.request : null);
      } catch {
        setRecoveryRequest(null);
      } finally {
        setRecoveryLoading(false);
      }
    }
    loadRecovery();
  }, [account.email]);

  // Unlock is only allowed when there is a pending recovery request.
  // This ensures the user has formally requested recovery for this
  // specific lockout instance before the admin can act.
  const canUnlock = !recoveryLoading && recoveryRequest !== null;

  async function handleUnlock() {
    if (!canUnlock || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/accounts/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token()}`,
          'x-api-key':    API_KEY,
        },
        body: JSON.stringify({
          email:       account.email,
          accountType: account.accountType, // 'user' | 'staff'
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }

      onUnlocked();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)',
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16, padding: '28px 32px',
          maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#dc2626" strokeWidth="1.8">
              <rect x="3" y="9" width="14" height="10" rx="2" />
              <path d="M7 9V6a3 3 0 016 0v3" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Unlock PIN</div>
            <div style={{ fontSize: 12, color: '#888' }}>{account.email}</div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 20 }}>
          This will reset <strong>pinAttempts</strong> to 0, clear <strong>pinLockedUntil</strong>, and set
          <strong> pinPermanentlyLocked</strong> to false for this account.
        </p>

        {/* ── Recovery Request Section ── */}
        <div style={{
          background: recoveryLoading ? '#f9fafb' : (recoveryRequest ? '#f9fafb' : '#fef9f0'),
          border: `1px solid ${recoveryLoading ? '#e5e7eb' : (recoveryRequest ? '#e5e7eb' : '#fde68a')}`,
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 20,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: recoveryLoading || recoveryRequest ? 10 : 0,
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#6b7280',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Recovery Request
            </span>
            {recoveryRequest && !recoveryLoading && (
              <span style={{
                display: 'inline-block',
                background: '#fffbeb', color: '#d97706',
                border: '1px solid #fde68a',
                borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
              }}>
                ⏳ Pending
              </span>
            )}
          </div>

          {recoveryLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', fontSize: 12 }}>
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                <path d="M4 4a8 8 0 0112 0M16 16a8 8 0 01-12 0" strokeLinecap="round" />
              </svg>
              Checking for recovery request…
            </div>
          ) : recoveryRequest ? (
            <div>
              {/* Reason */}
              <div style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 13,
                color: '#374151',
                lineHeight: 1.6,
                marginBottom: 8,
                fontStyle: 'italic',
              }}>
                "{recoveryRequest.reason}"
              </div>
              {/* Meta */}
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#9ca3af' }}>
                <span>Submitted: {fmt(recoveryRequest.createdAt)}</span>
                <span>Type: {recoveryRequest.accountType}</span>
              </div>
            </div>
          ) : (
            /* No pending request — unlock is blocked */
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 2 }}>
                  No pending recovery request
                </div>
                <div style={{ fontSize: 12, color: '#a16207', lineHeight: 1.5 }}>
                  The account must submit a recovery request before it can be unlocked.
                  Once submitted, it will appear here.
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: '8px 12px', marginBottom: 16,
            fontSize: 12, color: '#dc2626',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', fontSize: 13, cursor: 'pointer', color: '#555',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleUnlock}
            disabled={!canUnlock || loading}
            title={!canUnlock && !recoveryLoading ? 'Waiting for user to submit a recovery request' : ''}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: (!canUnlock || loading) ? '#d1d5db' : '#16a34a',
              color: (!canUnlock || loading) ? '#9ca3af' : '#fff',
              fontSize: 13, fontWeight: 600,
              cursor: (!canUnlock || loading) ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {loading ? 'Unlocking…' : 'Unlock Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Row ─────────────────────────────────────────────────────────── */
function AccountRow({ account, onUnlock }) {
  const now = new Date();
  const tempLocked = account.pinLockedUntil && new Date(account.pinLockedUntil) > now;
  const needsAttention = account.pinPermanentlyLocked || tempLocked;

  return (
    <tr style={{
      borderBottom: '1px solid #f3f4f6',
      background: needsAttention ? 'rgba(254,242,242,0.4)' : 'transparent',
      transition: 'background 0.12s',
    }}
      onMouseEnter={e => !needsAttention && (e.currentTarget.style.background = '#fafafa')}
      onMouseLeave={e => !needsAttention && (e.currentTarget.style.background = 'transparent')}
    >
      {/* Name / Email */}
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: account.accountType === 'staff' ? '#e0f2fe' : '#ede9fe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
            color: account.accountType === 'staff' ? '#0369a1' : '#7c3aed',
            flexShrink: 0,
          }}>
            {(account.name || account.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{account.name || '—'}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{account.email}</div>
          </div>
        </div>
      </td>

      {/* Type / Role */}
      <td style={{ padding: '12px 16px' }}>
        <RoleBadge role={account.role} type={account.accountType} />
      </td>

      {/* PIN Status */}
      <td style={{ padding: '12px 16px' }}>
        <PinBadge
          attempts={account.pinAttempts}
          permanentlyLocked={account.pinPermanentlyLocked}
          lockedUntil={account.pinLockedUntil}
        />
      </td>

      {/* pinAttempts */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: account.pinAttempts > 0 ? '#ea580c' : '#374151',
        }}>
          {account.pinAttempts ?? 0}
        </span>
      </td>

      {/* pinLockedUntil */}
      <td style={{ padding: '12px 16px', fontSize: 12, color: '#555' }}>
        {fmt(account.pinLockedUntil)}
      </td>

      {/* Last Login */}
      <td style={{ padding: '12px 16px', fontSize: 12, color: '#888' }}>
        {fmt(account.lastLoginAt)}
      </td>

      {/* Actions */}
      <td style={{ padding: '12px 16px' }}>
        {(account.pinPermanentlyLocked || account.pinAttempts > 0 || tempLocked) && (
          <button
            onClick={() => onUnlock(account)}
            style={{
              padding: '5px 12px', borderRadius: 7, border: '1px solid #d1fae5',
              background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'}
            onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}
          >
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="9" width="14" height="10" rx="2" />
              <path d="M7 9V6a3 3 0 016 0v3" strokeLinecap="round" />
            </svg>
            Unlock
          </button>
        )}
      </td>
    </tr>
  );
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function AccountsPage() {
  const [users, setUsers]       = useState([]);
  const [staffs, setStaffs]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [tab, setTab]           = useState('all');
  const [unlockTarget, setUnlockTarget] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchJSON('/api/accounts');
      setUsers(data.users || []);
      setStaffs(data.staffs || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Normalise into one flat list
  const combined = [
    ...users.map(u => ({
      ...u,
      accountType: 'user',
      name: u.businessName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
    })),
    ...staffs.map(s => ({
      ...s,
      accountType: 'staff',
      name: [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email,
    })),
  ];

  const now = new Date();
  const filtered = combined.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (a.name || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.role || '').toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (tab === 'users')  return a.accountType === 'user';
    if (tab === 'staffs') return a.accountType === 'staff';
    if (tab === 'locked') return a.pinPermanentlyLocked ||
      (a.pinLockedUntil && new Date(a.pinLockedUntil) > now) ||
      a.pinAttempts > 0;
    return true;
  });

  const lockedCount = combined.filter(a =>
    a.pinPermanentlyLocked ||
    (a.pinLockedUntil && new Date(a.pinLockedUntil) > now) ||
    a.pinAttempts > 0
  ).length;

  const tabs = [
    { id: 'all',    label: 'All Accounts', count: combined.length },
    { id: 'users',  label: 'Users',        count: users.length },
    { id: 'staffs', label: 'Staffs',       count: staffs.length },
    { id: 'locked', label: 'PIN Issues',   count: lockedCount, warn: lockedCount > 0 },
  ];

  return (
    <div className="db-layout">
      <Sidebar />

      <div className="db-main">
        {/* TopBar */}
        <header className="db-topbar">
          <div className="db-topbar__search">
            <span className="db-topbar__search-icon">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="9" r="7" />
                <path d="M15 15l3 3" strokeLinecap="round" />
              </svg>
            </span>
            <input type="text" placeholder="Search…" />
          </div>
          <div className="db-topbar__actions">
            <button className="db-topbar__icon-btn" title="Notifications">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10 2a6 6 0 00-6 6v3l-1.5 2H17.5L16 11V8a6 6 0 00-6-6z" />
                <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round" />
              </svg>
            </button>
            <div className="db-topbar__avatar" title="Admin User">A</div>
          </div>
        </header>

        <div className="cl-content">
        {/* Header */}
        <header className="db-content__header" style={{ marginBottom: 28 }}>
          <div>
            <h1 className="db-content__title">Accounts</h1>
            <p className="db-content__sub">
              All platform users and staffs — PIN lockout status, attempts, and access control.
            </p>
          </div>
        </header>

        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 16, flexWrap: 'wrap',
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
            <svg
              width="14" height="14" viewBox="0 0 20 20" fill="none"
              stroke="#aaa" strokeWidth="1.8"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="9" cy="9" r="6" />
              <path d="M15 15l-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, role…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px 8px 32px',
                borderRadius: 10, border: '1px solid #e5e7eb',
                fontSize: 13, outline: 'none', background: '#fff',
                color: '#222', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 3 }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '5px 12px', borderRadius: 7, border: 'none',
                  background: tab === t.id ? '#fff' : 'transparent',
                  color: tab === t.id ? '#0c1c14' : '#888',
                  fontWeight: tab === t.id ? 600 : 400,
                  fontSize: 12, cursor: 'pointer',
                  boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.12s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {t.label}
                <span style={{
                  background: t.warn ? '#fef2f2' : (tab === t.id ? '#f0fdf4' : '#e5e7eb'),
                  color: t.warn ? '#dc2626' : (tab === t.id ? '#16a34a' : '#888'),
                  borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                }}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              padding: '7px 14px', borderRadius: 9, border: '1px solid #e5e7eb',
              background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5, color: '#555',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}
            >
              <path d="M4 4a8 8 0 0112 0M16 16a8 8 0 01-12 0" strokeLinecap="round" />
              <path d="M20 4l-4 0 0 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M0 16l4 0 0-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
            padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Table */}
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb',
          overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#aaa', fontSize: 14 }}>
              Loading accounts…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#aaa', fontSize: 14 }}>
              No accounts found.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                    {['Account', 'Role', 'PIN Status', 'Attempts', 'Locked Until', 'Last Login', 'Actions'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: h === 'Attempts' ? 'center' : 'left',
                        fontSize: 11, fontWeight: 600, color: '#888',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <AccountRow key={`${a.accountType}-${a._id}`} account={a} onUnlock={setUnlockTarget} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer count */}
        {!loading && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#aaa', textAlign: 'right' }}>
            Showing {filtered.length} of {combined.length} accounts
          </div>
        )}

        {/* Unlock modal */}
        {unlockTarget && (
          <UnlockConfirmModal
            account={unlockTarget}
            onClose={() => setUnlockTarget(null)}
            onUnlocked={loadData}
          />
        )}

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
      </div>
    </div>
  );
}