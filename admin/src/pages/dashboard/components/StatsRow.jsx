const ICON_COLORS = {
  green:  { bg: '#e0f4ed', color: '#26a676' },
  blue:   { bg: '#dbeafe', color: '#3b82f6' },
  yellow: { bg: '#fef3c7', color: '#f59e0b' },
  red:    { bg: '#fee2e2', color: '#ef4444' },
};

/* Sparkline data per stat */
const SPARKLINES = {
  'TOTAL CLIENTS':    [98, 102, 105, 108, 110, 115, 119, 122, 125, 128],
  'TOTAL PROPERTIES': [480, 490, 498, 505, 512, 518, 525, 530, 537, 542],
  'MONTHLY REVENUE':  [9.8, 10.2, 10.5, 11.0, 11.4, 11.8, 12.0, 12.1, 12.3, 12.4],
};

const SPARK_COLORS = {
  green:  '#1a9e6e',
  blue:   '#3b82f6',
  yellow: '#f59e0b',
  red:    '#ef4444',
};

function Sparkline({ data, color }) {
  const W = 80, H = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <polygon
        points={`0,${H} ${pts} ${W},${H}`}
        fill={`url(#sg-${color})`}
      />
      {/* Line */}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STATIC_STATS = [
  {
    label: 'TOTAL CLIENTS',
    value: '128',
    change: '15 new',
    trend: 'up',
    color: 'green',
    detail: 'vs last month',
  },
  {
    label: 'TOTAL PROPERTIES',
    value: '542',
    change: '43 added',
    trend: 'up',
    color: 'blue',
    detail: 'vs last month',
  },
  {
    label: 'MONTHLY REVENUE',
    value: '₱12.4M',
    change: '8.3% increase',
    trend: 'up',
    color: 'red',
    detail: 'vs last month',
  },
];

function StatCard({ stat }) {
  const sparkData  = SPARKLINES[stat.label] ?? SPARKLINES[(stat.label || '').toUpperCase()] ?? [];
  const sparkColor = SPARK_COLORS[stat.color] ?? '#1a9e6e';

  return (
    <div className="db-stat-card" style={{ gap: 0 }}>
      {/* Top row: label (with clock icon) + See Details button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            border: '1.5px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-muted)', flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="10" cy="10" r="8"/><path d="M10 6v4l2.5 2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
            {stat.label}
          </span>
        </div>
        <button style={{
          fontSize: '.72rem', fontWeight: 600,
          color: 'var(--color-text)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-pill)',
          padding: '3px 10px',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          flexShrink: 0,
        }}>
          See Details
        </button>
      </div>

      {/* Value + change inline */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
        <div className="db-stat-card__value">{stat.value}</div>
        <span style={{
          fontSize: '.75rem', fontWeight: 600,
          color: stat.trend === 'up' ? '#059669' : '#dc2626',
        }}>
          ↑ {stat.change}
        </span>
      </div>

      {/* Bottom: sparkline left, detail text right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
        <Sparkline data={sparkData} color={sparkColor} />
        <p style={{
          fontSize: '.72rem', color: 'var(--color-muted)',
          textAlign: 'right', maxWidth: 130, lineHeight: 1.4, margin: 0,
        }}>
          {stat.detail}
        </p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="db-stat-card">
      <div className="db-skeleton" style={{ height: 12, width: '55%' }} />
      <div className="db-skeleton" style={{ height: 28, width: '40%', marginTop: 10 }} />
      <div className="db-skeleton" style={{ height: 32, width: '100%', marginTop: 10 }} />
    </div>
  );
}

export default function StatsRow({ stats, loading }) {
  if (loading) {
    return (
      <div className="db-stats">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  // Use live stats from /api/dashboard-overview when available; otherwise the
  // static sample acts as a placeholder. The live array comes from useStats →
  // buildStatsCards (Total Clients / Total Properties from user.js, Monthly
  // Revenue from aggregated Smoobu data).
  const liveStats = Array.isArray(stats) && stats.length > 0 ? stats : STATIC_STATS;

  return (
    <div className="db-stats">
      {liveStats.map((stat) => <StatCard key={stat.label} stat={stat} />)}
    </div>
  );
}