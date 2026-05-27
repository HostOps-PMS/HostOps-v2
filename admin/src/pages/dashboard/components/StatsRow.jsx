const ICON_COLORS = {
  green:  { bg: '#e0f4ed', color: '#26a676' },
  blue:   { bg: '#dbeafe', color: '#3b82f6' },
  yellow: { bg: '#fef3c7', color: '#f59e0b' },
  red:    { bg: '#fee2e2', color: '#ef4444' },
};

function StatCard({ stat }) {
  const palette = ICON_COLORS[stat.color] ?? ICON_COLORS.green;

  return (
    <div className="db-stat-card">
      <div className="db-stat-card__top">
        <span className="db-stat-card__label">{stat.label}</span>
        <div className="db-stat-card__icon" style={{ background: palette.bg, color: palette.color }}>
          {stat.icon}
        </div>
      </div>
      <div className="db-stat-card__value">{stat.value}</div>
      <div className={`db-stat-card__change db-stat-card__change--${stat.trend}`}>
        {stat.trend === 'up' ? '↑' : '↓'} {stat.change}
        <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}> vs last month</span>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="db-stat-card">
      <div className="db-skeleton" style={{ height: 14, width: '60%' }} />
      <div className="db-skeleton" style={{ height: 32, width: '45%', marginTop: 8 }} />
      <div className="db-skeleton" style={{ height: 12, width: '70%', marginTop: 4 }} />
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

  return (
    <div className="db-stats">
      {stats.map((stat) => <StatCard key={stat.label} stat={stat} />)}
    </div>
  );
}
