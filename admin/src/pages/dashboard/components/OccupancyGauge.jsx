// components/OccupancyGauge.jsx
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

// ── Static fallback data ──────────────────────────────────────────
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

/**
 * @param {object}   props
 * @param {Array}    [props.occupancyBreakdown]  — [{ propertyName, clientName, occupancy }]
 *                   from /api/dashboard-overview. If null, shows static fallback.
 * @param {number}   [props.overallOccupancy]    — 0-100 weighted average from backend.
 * @param {boolean}  [props.loading]
 */
export default function OccupancyGauge({ occupancyBreakdown, overallOccupancy, loading }) {
  const isLive = !loading && occupancyBreakdown && occupancyBreakdown.length > 0;

  // Decide which property list to show
  const properties = isLive
    ? occupancyBreakdown.map((p) => ({
        name:      p.propertyName || 'Property',
        subLabel:  p.clientName   || '',
        occupancy: p.occupancy    || 0,
      }))
    : FALLBACK_PROPERTIES.map((p) => ({ ...p, subLabel: '' }));

  // Compute overall from live data or use backend's pre-calculated value
  const overall = isLive
    ? (overallOccupancy ?? Math.round(
        properties.reduce((a, b) => a + b.occupancy, 0) / (properties.length || 1)
      ))
    : Math.round(
        FALLBACK_PROPERTIES.reduce((a, b) => a + b.occupancy, 0) / FALLBACK_PROPERTIES.length
      );

  const gaugeData = [
    { value: overall },
    { value: Math.max(0, 100 - overall) },
  ];

  if (loading) {
    return (
      <div className="db-table-card" style={{ flexShrink: 0 }}>
        <div className="db-table-card__head">
          <h2 className="db-table-card__title">Occupancy Rate</h2>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="db-skeleton" style={{ height: 14, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="db-table-card" style={{ flexShrink: 0 }}>
      <div className="db-table-card__head">
        <div>
          <h2 className="db-table-card__title">Occupancy Rate</h2>
          <p style={{ fontSize: '.72rem', color: 'var(--color-muted)', marginTop: 2 }}>
            Overall average
          </p>
        </div>
        {isLive && (
          <span style={{
            fontSize: '.68rem', fontWeight: 700,
            color: '#059669', background: '#d1fae5',
            border: '1px solid #6ee7b7',
            padding: '2px 8px', borderRadius: 999,
          }}>
            ● Live
          </span>
        )}
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        {/* Donut gauge */}
        <div style={{ position: 'relative', height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gaugeData}
                cx="50%"
                cy="85%"
                startAngle={180}
                endAngle={0}
                innerRadius={80}
                outerRadius={110}
                dataKey="value"
                strokeWidth={0}
              >
                <Cell fill={overall >= 70 ? '#1a9e6e' : overall >= 50 ? '#f59e0b' : '#ef4444'} />
                <Cell fill="#f0f0f0" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '2rem', fontWeight: 700,
              color: overall >= 70 ? '#1a9e6e' : overall >= 50 ? '#f59e0b' : '#ef4444',
              lineHeight: 1,
            }}>
              {overall}%
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--color-muted)', marginTop: 2 }}>
              avg occupancy
            </div>
          </div>
        </div>

        {/* Per property breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, maxHeight: 300, overflowY: 'auto' }}>
          {properties.map((p, i) => (
            <div key={p.name + i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.75rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.name}
                </div>
                {p.subLabel && (
                  <div style={{ fontSize: '.68rem', color: 'var(--color-muted)' }}>
                    {p.subLabel}
                  </div>
                )}
              </div>
              <div style={{ width: 80, height: 5, background: '#f0f0f0', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${p.occupancy}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--color-muted)', width: 32, textAlign: 'right' }}>
                {p.occupancy}%
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {isLive && properties.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: '.8rem', padding: '20px 0' }}>
            No property occupancy data available.
          </div>
        )}
      </div>
    </div>
  );
}