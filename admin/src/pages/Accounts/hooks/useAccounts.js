import { useState, useEffect, useCallback } from 'react';
import { authHeaders } from '../../../lib/authUtils';

const API = import.meta.env.VITE_API_URL || 'https://hostpilot-smoobu.onrender.com';

export async function fetchRecoveryRequest(email) {
  const res = await fetch(`${API}/api/accounts/recovery-request?email=${encodeURIComponent(email)}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function unlockAccount({ email, accountType }) {
  const res = await fetch(`${API}/api/accounts/unlock`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email, accountType }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function useAccounts() {
  const [users,   setUsers]   = useState([]);
  const [staffs,  setStaffs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/accounts`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUsers(data.users   || []);
      setStaffs(data.staffs || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const combined = [
    ...users
      .filter(u => u.role !== 'admin')
      .map(u => ({
        ...u, accountType: 'user',
        name: u.businessName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      })),
    ...staffs.map(s => ({
      ...s, accountType: 'staff',
      name: [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email,
    })),
  ];

  return { users, staffs, combined, loading, error, reload };
}

export function useFilteredAccounts({ combined, tab, search, page, pageSize = 10 }) {
  const now = new Date();
  const totalFiltered = combined.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (a.name  || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.role  || '').toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (tab === 'users')  return a.accountType === 'user';
    if (tab === 'staffs') return a.accountType === 'staff';
    if (tab === 'locked') return a.pinPermanentlyLocked ||
      (a.pinLockedUntil && new Date(a.pinLockedUntil) > now) || a.pinAttempts > 0;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(totalFiltered.length / pageSize));
  const filtered   = totalFiltered.slice((page - 1) * pageSize, page * pageSize);
  return { filtered, totalFiltered, totalPages };
}
