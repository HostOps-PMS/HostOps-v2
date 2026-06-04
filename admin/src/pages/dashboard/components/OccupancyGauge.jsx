import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const PROPERTIES = [
  { name: 'Haido Ville',   occupancy: 94 },
  { name: 'ABC Resort',    occupancy: 87 },
  { name: 'Mountain View', occupancy: 81 },
  { name: 'Sun Villa',     occupancy: 76 },
  { name: 'Paradise Inn',  occupancy: 72 },
  { name: 'Ocean Breeze',  occupancy: 68 },
];

const overall = Math.round(PROPERTIES.reduce((a, b) => a + b.occupancy, 0) / PROPERTIES.length);

const COLORS = ['#1a9e6e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

export default function OccupancyGauge() {
  const data = [
    { value: overall },
    { value: 100 - overall },
  ];

  return (
    <div className="db-table-card" style={{ flexShrink: 0 }}>
      <div className="db-table-card__head">
        <h2 className="db-table-card__title">Occupancy Rate</h2>
        <span style={{ fontSize: '.75rem', color: 'var(--color-muted)' }}>Overall average</span>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        {/* Donut gauge */}
        <div style={{ position: 'relative', height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="85%"
                startAngle={180}
                endAngle={0}
                innerRadius={80}
                outerRadius={110}
                dataKey="value"
                strokeWidth={0}
              >
                <Cell fill="#1a9e6e" />
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
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1a9e6e', lineHeight: 1 }}>
              {overall}%
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--color-muted)', marginTop: 2 }}>avg occupancy</div>
          </div>
        </div>

        {/* Per property breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {PROPERTIES.map((p, i) => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i], flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: '.75rem', color: 'var(--color-text)' }}>{p.name}</div>
              <div style={{ width: 80, height: 5, background: '#f0f0f0', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${p.occupancy}%`, height: '100%', background: COLORS[i], borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--color-muted)', width: 32, textAlign: 'right' }}>
                {p.occupancy}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}