import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  const [recoveryRequest, setRecoveryRequest] = useState(null);

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
          accountType: account.accountType,
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
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(12,28,20,0.45)',
      backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 20,
          maxWidth: 460, width: '100%',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '28px 32px 0 32px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{
              fontSize: '1.6rem', fontWeight: 800, color: '#0d1117',
              lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em',
            }}>
              Unlock <span style={{ color: '#26a676' }}>PIN</span>
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '.8125rem', color: '#9ca3af', fontWeight: 400 }}>
              Review the recovery request before unlocking.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f3f4f6', border: 'none', borderRadius: 10,
              width: 32, height: 32, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: '#6b7280',
              fontSize: '1rem', flexShrink: 0, marginTop: 2,
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 32px 0' }}>
          {/* Profile card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', borderRadius: 12,
            background: '#f8faf9', border: '1px solid #e5efe9',
            marginBottom: 16,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #26a676, #1d8a62)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '0.95rem', flexShrink: 0,
            }}>
              {(account.name || account.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0d1117' }}>
                {account.name || '—'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 1 }}>
                {account.email}
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <RoleBadge role={account.role} type={account.accountType} />
            </div>
          </div>

          <p style={{ fontSize: '.8125rem', color: '#6b7280', lineHeight: 1.6, marginBottom: 16, margin: '0 0 16px' }}>
            This will reset <strong>pinAttempts</strong> to 0, clear <strong>pinLockedUntil</strong>, and set <strong>pinPermanentlyLocked</strong> to false for this account.
          </p>

        <div style={{
          background: recoveryLoading ? '#f9fafb' : (recoveryRequest ? '#f9fafb' : '#fef9f0'),
          border: `1px solid ${recoveryLoading ? '#e5e7eb' : (recoveryRequest ? '#e5e7eb' : '#fde68a')}`,
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 16,
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
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#9ca3af' }}>
                <span>Submitted: {fmt(recoveryRequest.createdAt)}</span>
                <span>Type: {recoveryRequest.accountType}</span>
              </div>
            </div>
          ) : (
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
            background: '#fee2e2', color: '#b91c1c',
            borderRadius: 8, padding: '10px 14px',
            fontSize: '.8125rem', fontWeight: 500, marginBottom: 16,
          }}>
            ⚠️ {error}
          </div>
        )}

        </div> {/* end body div */}

        {/* Footer */}
        <div style={{
          padding: '16px 32px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 10, borderTop: '1px solid #f0f2f5', marginTop: 20,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 22px', borderRadius: 10,
              border: '1.5px solid #e5e7eb', background: '#fff',
              fontSize: '0.875rem', fontWeight: 600, color: '#374151',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleUnlock}
            disabled={!canUnlock || loading}
            title={!canUnlock && !recoveryLoading ? 'Waiting for user to submit a recovery request' : ''}
            style={{
              padding: '9px 26px', borderRadius: 10, border: 'none',
              background: (!canUnlock || loading) ? '#9ca3af' : '#0d1117',
              color: '#fff', fontSize: '0.875rem', fontWeight: 700,
              cursor: (!canUnlock || loading) ? 'not-allowed' : 'pointer',
              boxShadow: (!canUnlock || loading) ? 'none' : '0 2px 8px rgba(13,17,23,0.18)',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Unlocking…' : 'Unlock Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Tab Icons ───────────────────────────────────────────────────── */
const TAB_ICONS = {
  all: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round"/>
    </svg>
  ),
  users: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="10" cy="7" r="3"/>
      <path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeLinecap="round"/>
    </svg>
  ),
  staffs: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="7" cy="7" r="3"/>
      <path d="M1 17c0-3.314 2.686-6 6-6"/>
      <circle cx="14" cy="7" r="3"/>
      <path d="M13 11c3.314 0 6 2.686 6 6" strokeLinecap="round"/>
    </svg>
  ),
  locked: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="9" width="14" height="10" rx="2"/>
      <path d="M7 9V6a3 3 0 016 0v3" strokeLinecap="round"/>
    </svg>
  ),
};

/* ── Row ─────────────────────────────────────────────────────────── */
function AccountRow({ account, onUnlock, isLast }) {
  const now = new Date();
  const tempLocked = account.pinLockedUntil && new Date(account.pinLockedUntil) > now;
  const needsAttention = account.pinPermanentlyLocked || tempLocked;

  return (
    <tr
      style={{
        borderBottom: isLast ? 'none' : '1px solid #f7f8fa',
        background: needsAttention ? 'rgba(254,242,242,0.5)' : 'transparent',
        borderLeft: needsAttention ? '3px solid #fca5a5' : '3px solid transparent',
        transition: 'background 0.1s',
        cursor: 'default',
      }}
      onMouseEnter={e => { if (!needsAttention) e.currentTarget.style.background = '#fafbff'; }}
      onMouseLeave={e => { if (!needsAttention) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Name / Email */}
      <td style={{ padding: '12px 16px 12px 20px', minWidth: 160 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: account.accountType === 'staff' ? '#d1fae5' : '#d1fae5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
            color: account.accountType === 'staff' ? '#059669' : '#059669',
            flexShrink: 0,
          }}>
            {(account.name || account.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{account.name || '—'}</div>
            <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>{account.email}</div>
          </div>
        </div>
      </td>

      {/* Role */}
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

      {/* Attempts */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        <span style={{
          fontSize: '0.83rem', fontWeight: 700,
          color: account.pinAttempts > 0 ? '#ea580c' : '#374151',
        }}>
          {account.pinAttempts ?? 0}
        </span>
      </td>

      {/* Locked Until */}
      <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
        {fmt(account.pinLockedUntil)}
      </td>

      {/* Last Login */}
      <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
        {fmt(account.lastLoginAt)}
      </td>

      {/* Actions */}
      <td style={{ padding: '12px 16px 12px 8px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {(account.pinPermanentlyLocked || account.pinAttempts > 0 || tempLocked) && (
            <button
              onClick={() => onUnlock(account)}
              style={{
                padding: '5px 14px', borderRadius: 6,
                border: '1px solid #d1fae5', background: '#f0fdf4',
                fontSize: '0.78rem', fontWeight: 600, color: '#16a34a', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5,
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
        </div>
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
  const [page,         setPage]         = useState(1);
  const PAGE_SIZE = 10;

  const tabScrollRef  = useRef(null);
  const [tabScrollLeft, setTabScrollLeft]   = useState(0);
  const [tabScrollable, setTabScrollable]   = useState(false);

  function handleTabScroll() {
    const el = tabScrollRef.current;
    if (!el) return;
    setTabScrollLeft(el.scrollLeft);
    setTabScrollable(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }

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

  const lockedCount = combined.filter(a =>
    a.pinPermanentlyLocked ||
    (a.pinLockedUntil && new Date(a.pinLockedUntil) > now) ||
    a.pinAttempts > 0
  ).length;

  const tabs = [
    { id: 'all',    label: 'All',         count: combined.length },
    { id: 'users',  label: 'Users',       count: users.length },
    { id: 'staffs', label: 'Staffs',      count: staffs.length },
    { id: 'locked', label: 'PIN Issues',  count: lockedCount, warn: lockedCount > 0 },
  ];

  useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    setTabScrollable(el.scrollWidth > el.clientWidth);
  }, [tabs.length]);

  const totalFiltered = combined.filter(a => {
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

  const totalPages = Math.max(1, Math.ceil(totalFiltered.length / PAGE_SIZE));
  const filtered   = totalFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
          {/* Page Header */}
          <header className="cl-content__header" style={{ marginBottom: 28 }}>
            <div>
              <h1 className="cl-content__title">Accounts</h1>
              <p className="cl-content__sub">
                All platform users and staffs — PIN lockout status, attempts, and access control.
              </p>
            </div>
          </header>

          {/* ── Tab bar (floating, same as StaffTable) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 0, flexWrap: 'nowrap', gap: 10, paddingBottom: 0,
              overflow: 'hidden', position: 'relative',
            }}>
              {/* Left fade/arrow */}
              {tabScrollLeft > 0 && (
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 10,
                  display: 'flex', alignItems: 'center',
                  background: 'linear-gradient(to right, #f0f4f0 60%, transparent)',
                  paddingRight: 8, paddingLeft: 2, pointerEvents: 'none',
                }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2.5">
                    <path d="M13 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
              {/* Right fade/arrow */}
              {tabScrollable && (
                <div style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10,
                  display: 'flex', alignItems: 'center',
                  background: 'linear-gradient(to left, #f0f4f0 60%, transparent)',
                  paddingLeft: 8, paddingRight: 2, pointerEvents: 'none',
                }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2.5">
                    <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
              <div
                ref={tabScrollRef}
                onScroll={handleTabScroll}
                style={{
                display: 'flex', alignItems: 'flex-end', gap: 0,
                background: 'transparent',
                marginBottom: '-1px',
                overflowX: 'auto', WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none', msOverflowStyle: 'none',
              }}>
                {tabs.map(t => {
                  const isActive = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setTab(t.id); setPage(1); }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                        padding: '9px 18px 10px',
                        border: '1px solid',
                        borderColor: isActive ? '#e8ecf0' : 'transparent',
                        borderBottom: isActive ? '1px solid #fff' : 'none',
                        borderRadius: '10px 10px 0 0',
                        background: isActive ? '#fff' : 'transparent',
                        marginBottom: '-1px',
                        cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                        color: isActive ? '#10b981' : '#9ca3af',
                        transition: 'color 0.15s', whiteSpace: 'nowrap',
                        position: 'relative', zIndex: isActive ? 2 : 0,
                        boxShadow: 'none',
                      }}
                    >
                      {TAB_ICONS[t.id]}
                      {t.label}
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700,
                        padding: '1px 7px', borderRadius: 999,
                        background: t.warn
                          ? (isActive ? '#fef2f2' : 'transparent')
                          : (isActive ? '#d1fae5' : 'transparent'),
                        color: t.warn
                          ? (isActive ? '#dc2626' : '#f87171')
                          : (isActive ? '#10b981' : '#b0b7c3'),
                      }}>
                        {t.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Card (same structure as StaffTable) ── */}
            <div style={{
              background: '#fff', borderRadius: '0 12px 12px 12px',
              border: '1px solid #e8ecf0', overflow: 'visible',
              paddingBottom: 4, position: 'relative',
            }}>
              {/* Filter bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 16px 14px', borderBottom: '1px solid #f0f2f5', flexWrap: 'wrap', rowGap: 8,
              }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 120, maxWidth: 280 }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2"
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5" strokeLinecap="round"/>
                  </svg>
                  <input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search by name, email, role…"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '7px 12px 7px 32px',
                      borderRadius: 8, border: '1px solid #e5e7eb',
                      fontSize: '0.83rem', outline: 'none', background: '#fafafa',
                      color: '#1a202c',
                    }}
                  />
                </div>

                <span style={{ fontSize: '0.78rem', color: '#9ca3af', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {totalFiltered.length} account{totalFiltered.length !== 1 ? 's' : ''}
                </span>

                {/* Refresh button */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={loadData}
                  disabled={loading}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '7px 16px', borderRadius: 999,
                    border: '1px solid #e5e7eb', background: '#fff',
                    color: '#374151', fontSize: '0.82rem', fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>
                    <path d="M4 4a8 8 0 0112 0M16 16a8 8 0 01-12 0" strokeLinecap="round" />
                    <path d="M20 4l-4 0 0 4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M0 16l4 0 0-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Refresh
                </button>
                </div>
              </div>

              {error && (
                <div style={{
                  background: '#fee2e2', color: '#b91c1c',
                  borderRadius: 'var(--radius-sm)', padding: '12px 16px',
                  fontSize: '.875rem', fontWeight: 500, margin: '12px 16px 0',
                }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Table */}
              {loading ? (
                <div style={{ padding: 48, textAlign: 'center', color: '#a0aec0', fontSize: '0.875rem' }}>
                  Loading accounts…
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: '#a0aec0', fontSize: '0.875rem' }}>
                  {combined.length === 0 ? 'No accounts yet.' : 'No results match your search.'}
                </div>
              ) : (
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #f0f2f5' }}>
                        {['Account', 'Role', 'PIN Status', 'Attempts', 'Locked Until', 'Last Login', ''].map(h => (
                          <th key={h} style={{
                            padding: '10px 16px',
                            textAlign: h === 'Attempts' ? 'center' : 'left',
                            fontSize: '0.72rem', fontWeight: 700,
                            color: '#9ca3af', letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap', background: 'transparent',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((a, i) => (
                        <AccountRow
                          key={`${a.accountType}-${a._id}`}
                          account={a}
                          onUnlock={setUnlockTarget} 
                          isLast={i === filtered.length - 1}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            {/* Pagination */}
              {!loading && totalPages > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px',
                borderTop: '1px solid #f0f2f5',
              }}>
                <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                  Page {page} of {totalPages} · {totalFiltered.length} account{totalFiltered.length !== 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      background: page === 1 ? '#f9fafb' : '#fff',
                      color: page === 1 ? '#d1d5db' : '#374151',
                      fontSize: '0.82rem', fontWeight: 600,
                      cursor: page === 1 ? 'not-allowed' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (page !== 1) e.currentTarget.style.background = '#f3f4f6'; }}
                    onMouseLeave={e => { if (page !== 1) e.currentTarget.style.background = '#fff'; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M13 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Prev
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      background: page === totalPages ? '#f9fafb' : '#fff',
                      color: page === totalPages ? '#d1d5db' : '#374151',
                      fontSize: '0.82rem', fontWeight: 600,
                      cursor: page === totalPages ? 'not-allowed' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (page !== totalPages) e.currentTarget.style.background = '#f3f4f6'; }}
                    onMouseLeave={e => { if (page !== totalPages) e.currentTarget.style.background = '#fff'; }}
                  >
                    Next
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            </div>

          </div>
        </div>
      </div>

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
  );
}