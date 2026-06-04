/* ── Growth Metrics Row ─────────────────────────────────────── */
const GROWTH_DATA = [
  {
    label: 'New Clients This Month',
    value: '+15',
    sub: '128 total clients',
    color: 'green',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="8" cy="7" r="4" />
        <path d="M2 18c0-3.314 2.686-6 6-6h4c3.314 0 6 2.686 6 6" strokeLinecap="round" />
        <path d="M16 3v6M13 6h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'New Properties Added',
    value: '+43',
    sub: '542 total properties',
    color: 'blue',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 10L10 3l7 7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 8.5V17h4v-4h2v4h4V8.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 3v3" strokeLinecap="round" />
        <path d="M12 3h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Booking Growth',
    value: '+21%',
    sub: '1,842 active bookings',
    color: 'yellow',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polyline points="2,15 7,9 11,12 18,5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="14,5 18,5 18,9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Monthly Revenue Processed',
    value: '+8.3%',
    sub: '₱12.4M total this month',
    color: 'red',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="10" cy="10" r="8" />
        <path d="M10 6v1.5M10 12.5V14" strokeLinecap="round" />
        <path d="M7.5 8.5a2.5 2 0 0 1 5 0c0 1.5-1.5 2-2.5 2.5S8 12 8 13.5h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const PALETTE = {
  green:  { bg: '#e0f4ed', color: '#26a676', bar: '#1a9e6e' },
  blue:   { bg: '#dbeafe', color: '#3b82f6', bar: '#3b82f6' },
  yellow: { bg: '#fef3c7', color: '#d97706', bar: '#f59e0b' },
  red:    { bg: '#fee2e2', color: '#ef4444', bar: '#ef4444' },
};

function GrowthCard({ item }) {
  const p = PALETTE[item.color] ?? PALETTE.green;
  return (
    <div className="db-stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 4, background: p.bar, borderRadius: '4px 0 0 4px',
      }} />
      <div style={{ paddingLeft: 8 }}>
        <div className="db-stat-card__top">
          <span className="db-stat-card__label">{item.label}</span>
          <div className="db-stat-card__icon" style={{ background: p.bg, color: p.color }}>
            {item.icon}
          </div>
        </div>
        <div className="db-stat-card__value" style={{ color: p.color }}>{item.value}</div>
        <div style={{
          fontSize: '.78rem',
          color: 'var(--color-muted)',
          marginTop: 4,
          fontFamily: 'var(--font-body)',
        }}>
          {item.sub}
        </div>
      </div>
    </div>
  );
}

export default function GrowthMetrics() {
  return (
    <div className="db-stats">
      {GROWTH_DATA.map(item => (
        <GrowthCard key={item.label} item={item} />
      ))}
    </div>
  );
}