import { useState } from 'react';

/* ── Sample top clients data ─────────────────────────────────── */
const TOP_CLIENTS = [
  { rank: 1, name: 'Haido Ville',    revenue: 2840000, occupancy: 94, bookings: 312, avatar: 'HV' },
  { rank: 2, name: 'ABC Resort',     revenue: 2210000, occupancy: 87, bookings: 268, avatar: 'AR' },
  { rank: 3, name: 'Mountain View',  revenue: 1980000, occupancy: 81, bookings: 241, avatar: 'MV' },
  { rank: 4, name: 'Sun Villa',      revenue: 1540000, occupancy: 76, bookings: 198, avatar: 'SV' },
  { rank: 5, name: 'Paradise Inn',   revenue: 1320000, occupancy: 72, bookings: 175, avatar: 'PI' },
  { rank: 6, name: 'Ocean Breeze',   revenue: 1100000, occupancy: 68, bookings: 142, avatar: 'OB' },
];

const SORT_OPTS = ['Revenue', 'Occupancy %', 'Active Bookings'];

const AVATAR_COLORS = ['#1a9e6e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

const RANK_BADGES = {
  1: { bg: '#fef9c3', color: '#a16207', label: '🥇' },
  2: { bg: '#f1f5f9', color: '#475569', label: '🥈' },
  3: { bg: '#fef3e8', color: '#c2590a', label: '🥉' },
};

function formatRevenue(v) {
  if (v >= 1_000_000) return '₱' + (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000)     return '₱' + (v / 1_000).toFixed(0) + 'K';
  return '₱' + v;
}

function OccupancyBar({ pct }) {
  return (
    <div style={{
      width: '100%', height: 6, background: 'var(--color-surface-2)',
      borderRadius: 99, overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: pct >= 85 ? '#1a9e6e' : pct >= 70 ? '#3b82f6' : '#f59e0b',
        borderRadius: 99,
        transition: 'width .4s',
      }} />
    </div>
  );
}

export default function TopClients() {
  const [sortBy, setSortBy] = useState('Revenue');

  const sorted = [...TOP_CLIENTS].sort((a, b) => {
    if (sortBy === 'Revenue')          return b.revenue   - a.revenue;
    if (sortBy === 'Occupancy %')      return b.occupancy - a.occupancy;
    if (sortBy === 'Active Bookings')  return b.bookings  - a.bookings;
    return 0;
  });

  return (
    <div className="db-table-card" style={{ flexShrink: 0, height: '100%' }}>
      {/* Header */}
      <div className="db-table-card__head" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 className="db-table-card__title">Top Clients</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {SORT_OPTS.map(opt => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              style={{
                padding: '4px 11px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-border)',
                background: sortBy === opt ? 'var(--color-brand)' : 'var(--color-surface)',
                color: sortBy === opt ? '#fff' : 'var(--color-muted)',
                fontWeight: 600,
                fontSize: '.75rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'background .15s, color .15s',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ padding: '0 10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sorted.map((client, idx) => {
          const badge = RANK_BADGES[idx + 1];
          return (
            <div
              key={client.name}
              className="top-clients-row"
              style={{
                display: 'grid',
                gridTemplateColumns: 'var(--top-clients-cols, 24px 34px 1fr 75px 75px)',
                alignItems: 'center',
                gap: 12,
                padding: '8px 8px',
                borderRadius: 10,
                background: idx === 0 ? '#f0faf6' : 'transparent',
                transition: 'background .12s',
                cursor: 'default',
              }}
              onMouseEnter={e => { if (idx > 0) e.currentTarget.style.background = 'var(--color-surface-2)'; }}
              onMouseLeave={e => { if (idx > 0) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Rank */}
              <div style={{ fontSize: '1rem', textAlign: 'center' }}>
                {badge ? badge.label : <span style={{ fontSize: '.85rem', color: 'var(--color-muted)', fontWeight: 700 }}>#{idx + 1}</span>}
              </div>

              {/* Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: AVATAR_COLORS[idx] || '#1a9e6e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {client.avatar}
              </div>

              {/* Name */}
              <div>
                <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--color-text)' }}>
                  {client.name}
                </div>
                <div style={{
                  fontSize: '.68rem',
                  marginTop: 1,
                  color: sortBy === 'Active Bookings' ? '#1e40af' : 'var(--color-muted)',
                  fontWeight: sortBy === 'Active Bookings' ? 700 : 400,
                  transition: 'color .2s, font-weight .2s',
                }}>
                  {client.bookings} bookings
                </div>
              </div>

              {/* Revenue */}
              <div style={{
                textAlign: 'right',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '.875rem',
                color: sortBy === 'Revenue' ? '#1a9e6e' : 'var(--color-text)',
              }}>
                {formatRevenue(client.revenue)}
              </div>

              {/* Occupancy bar + label */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <OccupancyBar pct={client.occupancy} />
                <div style={{
                  fontSize: '.72rem', textAlign: 'right',
                  color: sortBy === 'Occupancy %' ? '#3b82f6' : 'var(--color-muted)',
                  fontWeight: sortBy === 'Occupancy %' ? 700 : 400,
                }}>
                  {client.occupancy}% occ.
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}