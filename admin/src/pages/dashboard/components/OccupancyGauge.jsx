// components/OccupancyGauge.jsx
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../../context/ThemeContext';

const FALLBACK_PROPERTIES = [
  { name: 'Haido Ville',   occupancy: 94 },
  { name: 'ABC Resort',    occupancy: 87 },
  { name: 'Mountain View', occupancy: 81 },
  { name: 'Sun Villa',     occupancy: 76 },
  { name: 'Paradise Inn',  occupancy: 72 },
  { name: 'Ocean Breeze',  occupancy: 68 },
];

const COLORS = ['#1a9e6e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4',
                '#ec4899', '#14b8a6', '#f97316', '#a855f7'];

export default function OccupancyGauge({ occupancyBreakdown, overallOccupancy, loading }) {
  const { dark } = useTheme();
  const isLive = !loading && occupancyBreakdown && occupancyBreakdown.length > 0;

  const properties = isLive
    ? occupancyBreakdown.map((p) => ({
        name:      p.propertyName || 'Property',
        subLabel:  p.clientName   || '',
        occupancy: p.occupancy    || 0,
      }))
    : FALLBACK_PROPERTIES.map((p) => ({ ...p, subLabel: '' }));

  const overall = isLive
    ? (overallOccupancy ?? Math.round(properties.reduce((a, b) => a + b.occupancy, 0) / (properties.length || 1)))
    : Math.round(FALLBACK_PROPERTIES.reduce((a, b) => a + b.occupancy, 0) / FALLBACK_PROPERTIES.length);

  const gaugeData = [{ value: overall }, { value: Math.max(0, 100 - overall) }];
  const gaugeColor = overall >= 70 ? '#1a9e6e' : overall >= 50 ? '#f59e0b' : '#ef4444';

  if (loading) {
    return (
      <div className="db-table-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="db-table-card__head"><h2 className="db-table-card__title">Occupancy Rate</h2></div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (<div key={i} className="db-skeleton" style={{ height: 14, borderRadius: 8 }} />))}
        </div>
      </div>
    );
  }

  return (
    <div className="db-table-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="db-table-card__head" style={{ flexShrink: 0 }}>
        <div>
          <h2 className="db-table-card__title">Occupancy Rate</h2>
          <p style={{ fontSize: '.72rem', color: 'var(--color-muted)', marginTop: 2 }}>Overall average</p>
        </div>
        {isLive && (
          <span style={{ fontSize: '.68rem', fontWeight: 700, color: '#059669', background: dark ? '#052e16' : '#d1fae5', border: `1px solid ${dark ? '#166534' : '#6ee7b7'}`, padding: '2px 8px', borderRadius: 999 }}>● Live</span>
        )}
      </div>

      {/* Gauge — fixed height */}
      <div style={{ padding: '0 20px', flexShrink: 0 }}>
        <div style={{ position: 'relative', height: 130 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
            <PieChart>
              <Pie data={gaugeData} cx="50%" cy="90%" startAngle={180} endAngle={0} innerRadius={65} outerRadius={90} dataKey="value" strokeWidth={0}>
                <Cell fill={gaugeColor} />
                <Cell fill={dark ? '#1e3a2a' : '#f0f0f0'} />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: gaugeColor, lineHeight: 1 }}>{overall}%</div>
            <div style={{ fontSize: '.68rem', color: 'var(--color-muted)', marginTop: 2 }}>avg occupancy</div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: dark ? '#1e3a2a' : '#f0f2f5', margin: '0 20px' }} />

      {/* Property list — scrollable */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 20px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {properties.map((p, i) => (
            <div key={p.name + i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.name}
                </div>
                {p.subLabel && (
                  <div style={{ fontSize: '.68rem', color: 'var(--color-muted)', marginTop: 1 }}>{p.subLabel}</div>
                )}
              </div>
              <div style={{ width: 70, height: 6, background: dark ? '#1e3a2a' : '#f0f0f0', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${p.occupancy}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 99, transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--color-text)', width: 36, textAlign: 'right' }}>
                {p.occupancy}%
              </div>
            </div>
          ))}
        </div>

        {isLive && properties.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: '.8rem', padding: '20px 0' }}>
            No property occupancy data available.
          </div>
        )}
      </div>
    </div>
  );
}
