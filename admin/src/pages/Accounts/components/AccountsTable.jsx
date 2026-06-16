import { useRef, useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import AccountRow from './AccountRow';

const TAB_ICONS = {
  all:    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round"/></svg>,
  users:  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="7" r="3"/><path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeLinecap="round"/></svg>,
  staffs: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="7" r="3"/><path d="M1 17c0-3.314 2.686-6 6-6"/><circle cx="14" cy="7" r="3"/><path d="M13 11c3.314 0 6 2.686 6 6" strokeLinecap="round"/></svg>,
  locked: <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="9" width="14" height="10" rx="2"/><path d="M7 9V6a3 3 0 016 0v3" strokeLinecap="round"/></svg>,
};

const VIEW_OPTS = [
  {
    id: 'accounts', label: 'Accounts',
    icon: <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="7" r="3"/><path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeLinecap="round"/></svg>,
  },
  {
    id: 'archives', label: 'Archives',
    icon: <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="16" height="11" rx="1.5"/><path d="M2 6l2-3h12l2 3" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 11h4" strokeLinecap="round"/></svg>,
  },
];

function ViewToggle({ view, onViewChange }) {
  const { dark } = useTheme();
  return (
    <div style={{ display: 'inline-flex', background: dark ? '#0d2619' : '#eef0f3', borderRadius: 8, padding: 3, flexShrink: 0 }}>
      {VIEW_OPTS.map(v => {
        const active = view === v.id;
        return (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 11px', borderRadius: 6, border: 'none',
              background: active ? (dark ? '#132a1e' : '#fff') : 'transparent',
              color: active ? (v.id === 'archives' ? (dark ? '#fbbf24' : '#92400e') : (dark ? '#4ade80' : '#065f46')) : (dark ? '#4d8a6a' : '#6b7280'),
              fontWeight: active ? 700 : 500, fontSize: '0.76rem',
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: active ? '0 1px 5px rgba(0,0,0,0.10)' : 'none',
              transition: 'all 0.16s ease',
            }}
          >
            <span style={{ color: active ? (v.id === 'archives' ? '#f59e0b' : '#10b981') : '#b0b7c3', display: 'flex', transition: 'color 0.16s' }}>
              {v.icon}
            </span>
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

function TabBar({ tabs, activeTab, onTabChange, view, onViewChange }) {
  const { dark } = useTheme();
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
    <div style={{ display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
      {/* Scrollable tabs */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {scrollLeft > 0 && (
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 10, display: 'flex', alignItems: 'center', background: dark ? 'linear-gradient(to right, #0c1c14 60%, transparent)' : 'linear-gradient(to right, #f0f4f0 60%, transparent)', paddingRight: 8, pointerEvents: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2.5"><path d="M13 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        )}
        {scrollable && (
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10, display: 'flex', alignItems: 'center', background: dark ? 'linear-gradient(to left, #0c1c14 60%, transparent)' : 'linear-gradient(to left, #f0f4f0 60%, transparent)', paddingLeft: 8, pointerEvents: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2.5"><path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        )}
        <div ref={ref} onScroll={onScroll} style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '-1px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {tabs.map(t => {
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => onTabChange(t.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px 10px', border: '1px solid', borderColor: active ? (dark ? '#1e3a2a' : '#e8ecf0') : 'transparent', borderBottom: active ? `1px solid ${dark ? '#132a1e' : '#fff'}` : 'none', borderRadius: '10px 10px 0 0', background: active ? (dark ? '#132a1e' : '#fff') : 'transparent', marginBottom: '-1px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: active ? '#10b981' : (dark ? '#4d8a6a' : '#9ca3af'), transition: 'color 0.15s', whiteSpace: 'nowrap', position: 'relative', zIndex: active ? 2 : 0 }}>
                {TAB_ICONS[t.id]}
                {t.label}
                {t.count !== null && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: t.warn ? (active ? (dark ? '#2a0d0d' : '#fef2f2') : 'transparent') : (active ? (dark ? '#0d2619' : '#d1fae5') : 'transparent'), color: t.warn ? (active ? '#dc2626' : '#f87171') : (active ? '#10b981' : (dark ? '#4d8a6a' : '#b0b7c3')) }}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggle — right side of the tab row */}
      <div style={{ paddingBottom: 6, paddingLeft: 10, flexShrink: 0 }}>
        <ViewToggle view={view} onViewChange={onViewChange} />
      </div>
    </div>
  );
}

export default function AccountsTable({
  tabs, activeTab, onTabChange,
  view, onViewChange,
  filtered, totalFiltered, combined,
  loading, error,
  search, onSearchChange,
  page, totalPages, onPageChange,
  onDetails, onArchive, onRefresh,
}) {
  const { dark } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} view={view} onViewChange={onViewChange} />

     <div style={{ background: dark ? '#132a1e' : '#fff', borderRadius: '0 12px 12px 12px', border: `1px solid ${dark ? '#1e3a2a' : '#e8ecf0'}`, overflow: 'visible', paddingBottom: 4 }}>

        {/* Filter bar — search + count + refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 12px', borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}`, flexWrap: 'wrap', rowGap: 8 }}>

          <div style={{ position: 'relative', flex: 1, minWidth: 120, maxWidth: 260 }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="9" cy="9" r="6"/><path d="M15 15l-3.5-3.5" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search by name, email, role…"
              style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px 6px 29px', borderRadius: 7, border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`, fontSize: '0.8rem', outline: 'none', background: dark ? '#0d2619' : '#fafafa', color: dark ? '#eaf5f0' : '#1a202c' }}
            />
          </div>

          <span style={{ fontSize: '0.76rem', color: dark ? '#4d8a6a' : '#9ca3af', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {totalFiltered.length} account{totalFiltered.length !== 1 ? 's' : ''}
          </span>

          <button
            onClick={onRefresh} disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 7, border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`, background: dark ? '#0d2619' : '#fff', color: dark ? '#7ab89a' : '#374151', fontSize: '0.78rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s', flexShrink: 0 }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = dark ? '#132a1e' : '#f9fafb'; }}
            onMouseLeave={e => e.currentTarget.style.background = dark ? '#0d2619' : '#fff'}
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: loading ? 'ac-spin 0.8s linear infinite' : 'none' }}>
              <path d="M4 4a8 8 0 0112 0M16 16a8 8 0 01-12 0" strokeLinecap="round"/>
              <path d="M20 4l-4 0 0 4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M0 16l4 0 0-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Refresh
          </button>
        </div>

        <style>{`
          @keyframes ac-spin    { to { transform: rotate(360deg); } }
          @keyframes ac-shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
          .ac-sk { background: linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%); background-size:1200px 100%; animation:ac-shimmer 1.5s ease-in-out infinite; border-radius:5px; }
        `}</style>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: '0.83rem', fontWeight: 500, margin: '10px 14px 0' }}>⚠️ {error}</div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: i < 5 ? `1px solid ${dark ? '#1e3a2a' : '#f7f8fa'}` : 'none' }}>
                    <td style={{ padding: '13px 16px 13px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="ac-sk" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0 }} />
                        <div>
                          <div className="ac-sk" style={{ width: 110 + (i % 3) * 20, height: 12, marginBottom: 6 }} />
                          <div className="ac-sk" style={{ width: 150 + (i % 2) * 30, height: 10 }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px' }}><div className="ac-sk" style={{ width: 62, height: 20 }} /></td>
                    <td style={{ padding: '13px 16px' }}><div className="ac-sk" style={{ width: 48, height: 20 }} /></td>
                    <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <div className="ac-sk" style={{ width: 64, height: 26 }} />
                        <div className="ac-sk" style={{ width: 64, height: 26 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: dark ? '#4d8a6a' : '#a0aec0', fontSize: '0.875rem' }}>
            {combined.length === 0 ? 'No accounts yet.' : 'No results match your search.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}` }}>
                  <th style={{ padding: '9px 16px 9px 20px', textAlign: 'left',  fontSize: '0.7rem', fontWeight: 700, color: dark ? '#4d8a6a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Account</th>
                  <th style={{ padding: '9px 16px',           textAlign: 'left',  fontSize: '0.7rem', fontWeight: 700, color: dark ? '#4d8a6a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Role</th>
                  <th style={{ padding: '9px 16px',           textAlign: 'left',  fontSize: '0.7rem', fontWeight: 700, color: dark ? '#4d8a6a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ padding: '9px 16px',           textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: dark ? '#4d8a6a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <AccountRow
                    key={`${a.accountType}-${a._id}`}
                    account={a}
                    onDetails={onDetails}
                    onArchive={onArchive}
                    isLast={i === filtered.length - 1}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: `1px solid ${dark ? '#1e3a2a' : '#f0f2f5'}` }}>
            <span style={{ fontSize: '0.75rem', color: dark ? '#4d8a6a' : '#9ca3af' }}>Page {page} of {totalPages} · {totalFiltered.length} account{totalFiltered.length !== 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['prev', page === 1, () => onPageChange(p => Math.max(1, p - 1))], ['next', page === totalPages, () => onPageChange(p => Math.min(totalPages, p + 1))]].map(([dir, disabled, onClick]) => (
                <button key={dir} onClick={onClick} disabled={disabled}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: `1px solid ${dark ? '#1e3a2a' : '#e5e7eb'}`, background: disabled ? (dark ? '#0a1a10' : '#f9fafb') : (dark ? '#0d2619' : '#fff'), color: disabled ? (dark ? '#2a4a35' : '#d1d5db') : (dark ? '#7ab89a' : '#374151'), fontSize: '0.78rem', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = dark ? '#132a1e' : '#f3f4f6'; }}
                  onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = disabled ? (dark ? '#0a1a10' : '#f9fafb') : (dark ? '#0d2619' : '#fff'); }}
                >
                  {dir === 'prev' && <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  {dir === 'prev' ? 'Prev' : 'Next'}
                  {dir === 'next' && <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
