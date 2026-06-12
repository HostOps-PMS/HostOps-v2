import { useRef, useState, useEffect } from 'react';
import AccountRow from './AccountRow';

const TAB_ICONS = {
  all:    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round"/></svg>,
  users:  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="7" r="3"/><path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeLinecap="round"/></svg>,
  staffs: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="7" r="3"/><path d="M1 17c0-3.314 2.686-6 6-6"/><circle cx="14" cy="7" r="3"/><path d="M13 11c3.314 0 6 2.686 6 6" strokeLinecap="round"/></svg>,
  locked: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="9" width="14" height="10" rx="2"/><path d="M7 9V6a3 3 0 016 0v3" strokeLinecap="round"/></svg>,
};

function TabBar({ tabs, activeTab, onTabChange }) {
  const ref = useRef(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setScrollable(el.scrollWidth > el.clientWidth);
  }, [tabs.length]);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    setScrollLeft(el.scrollLeft);
    setScrollable(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', overflow: 'hidden', position: 'relative' }}>
      {scrollLeft > 0 && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 10, display: 'flex', alignItems: 'center', background: 'linear-gradient(to right, #f0f4f0 60%, transparent)', paddingRight: 8, pointerEvents: 'none' }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2.5"><path d="M13 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      {scrollable && (
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10, display: 'flex', alignItems: 'center', background: 'linear-gradient(to left, #f0f4f0 60%, transparent)', paddingLeft: 8, pointerEvents: 'none' }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2.5"><path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      <div ref={ref} onScroll={onScroll} style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '-1px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {tabs.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => onTabChange(t.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px 10px', border: '1px solid', borderColor: active ? '#e8ecf0' : 'transparent', borderBottom: active ? '1px solid #fff' : 'none', borderRadius: '10px 10px 0 0', background: active ? '#fff' : 'transparent', marginBottom: '-1px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: active ? '#10b981' : '#9ca3af', transition: 'color 0.15s', whiteSpace: 'nowrap', position: 'relative', zIndex: active ? 2 : 0 }}>
              {TAB_ICONS[t.id]}
              {t.label}
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: t.warn ? (active ? '#fef2f2' : 'transparent') : (active ? '#d1fae5' : 'transparent'), color: t.warn ? (active ? '#dc2626' : '#f87171') : (active ? '#10b981' : '#b0b7c3') }}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AccountsTable({
  tabs, activeTab, onTabChange,
  filtered, totalFiltered, combined,
  loading, error,
  search, onSearchChange,
  page, totalPages, onPageChange,
  onUnlock, onRefresh,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />

      <div style={{ background: '#fff', borderRadius: '0 12px 12px 12px', border: '1px solid #e8ecf0', overflow: 'visible', paddingBottom: 4 }}>
        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 14px', borderBottom: '1px solid #f0f2f5', flexWrap: 'wrap', rowGap: 8 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 120, maxWidth: 280 }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5" strokeLinecap="round"/>
            </svg>
            <input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Search by name, email, role…" style={{ width: '100%', boxSizing: 'border-box', padding: '7px 12px 7px 32px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: '0.83rem', outline: 'none', background: '#fafafa', color: '#1a202c' }} />
          </div>
          <span style={{ fontSize: '0.78rem', color: '#9ca3af', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {totalFiltered.length} account{totalFiltered.length !== 1 ? 's' : ''}
          </span>
          <button onClick={onRefresh} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: '0.82rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#f9fafb'; }}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>
              <path d="M4 4a8 8 0 0112 0M16 16a8 8 0 01-12 0" strokeLinecap="round" />
              <path d="M20 4l-4 0 0 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M0 16l4 0 0-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '12px 16px', fontSize: '.875rem', fontWeight: 500, margin: '12px 16px 0' }}>⚠️ {error}</div>}

        {/* Table */}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#a0aec0', fontSize: '0.875rem' }}>Loading accounts…</div>
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
                    <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Attempts' ? 'center' : 'left', fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <AccountRow key={`${a.accountType}-${a._id}`} account={a} onUnlock={onUnlock} isLast={i === filtered.length - 1} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #f0f2f5' }}>
            <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Page {page} of {totalPages} · {totalFiltered.length} account{totalFiltered.length !== 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['prev', page === 1, () => onPageChange(p => Math.max(1, p - 1))], ['next', page === totalPages, () => onPageChange(p => Math.min(totalPages, p + 1))]].map(([dir, disabled, onClick]) => (
                <button key={dir} onClick={onClick} disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: disabled ? '#f9fafb' : '#fff', color: disabled ? '#d1d5db' : '#374151', fontSize: '0.82rem', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#f3f4f6'; }}
                  onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = disabled ? '#f9fafb' : '#fff'; }}
                >
                  {dir === 'prev' && <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  {dir === 'prev' ? 'Prev' : 'Next'}
                  {dir === 'next' && <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
