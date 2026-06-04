import { useState, useEffect, useRef } from 'react';

/* ── Sample data per period ─────────────────────────────────── */
const CHART_DATA = {
  Daily: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    revenue:      [42000, 58000, 51000, 67000, 73000, 89000, 61000],
    bookings:     [12, 18, 15, 21, 24, 30, 19],
    cancellations:[1, 2, 1, 3, 2, 1, 2],
  },
  Weekly: {
    labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
    revenue:      [310000, 420000, 390000, 510000],
    bookings:     [88, 112, 99, 134],
    cancellations:[8, 11, 7, 13],
  },
  Monthly: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    revenue:      [980000,1120000,1050000,1340000,1280000,1540000,1620000,1480000,1390000,1710000,1850000,2100000],
    bookings:     [310, 350, 330, 410, 395, 460, 490, 445, 420, 510, 560, 630],
    cancellations:[28, 34, 30, 42, 38, 45, 50, 44, 39, 49, 55, 61],
  },
  Yearly: {
    labels: ['2020', '2021', '2022', '2023', '2024'],
    revenue:      [8500000,10200000,12800000,15400000,18900000],
    bookings:     [2800, 3400, 4200, 5100, 6300],
    cancellations:[280, 340, 410, 490, 590],
  },
};

const PERIODS = ['Daily', 'Weekly', 'Monthly', 'Yearly'];

const SERIES = [
  { key: 'revenue',      label: 'Revenue (₱)', color: '#1a9e6e', yAxis: 'left' },
  { key: 'bookings',     label: 'Bookings',    color: '#3b82f6', yAxis: 'right' },
  { key: 'cancellations',label: 'Cancellations', color: '#f59e0b', yAxis: 'right' },
];

function formatRevenue(v) {
  if (v >= 1_000_000) return '₱' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return '₱' + (v / 1_000).toFixed(0) + 'K';
  return '₱' + v;
}

/* ── Tiny SVG line chart ────────────────────────────────────── */
function LineChart({ data, labels, series, activeSeries }) {
  const W = 680, H = 260, PAD = { top: 20, right: 50, bottom: 36, left: 60 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const leftSeries  = series.filter(s => activeSeries.includes(s.key) && s.yAxis === 'left');
  const rightSeries = series.filter(s => activeSeries.includes(s.key) && s.yAxis === 'right');

  const maxLeft  = Math.max(...leftSeries.flatMap(s  => data[s.key]  ?? [0]), 1);
  const maxRight = Math.max(...rightSeries.flatMap(s => data[s.key]  ?? [0]), 1);

  const n = labels.length;

  function xPos(i) { return PAD.left + (i / Math.max(n - 1, 1)) * iW; }
  function yPosL(v) { return PAD.top + iH - (v / maxLeft)  * iH; }
  function yPosR(v) { return PAD.top + iH - (v / maxRight) * iH; }

  function makePath(vals, yFn) {
    return vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yFn(v).toFixed(1)}`).join(' ');
  }

  const TICK_COUNT = 4;
  const leftTicks  = Array.from({ length: TICK_COUNT + 1 }, (_, i) => (maxLeft  / TICK_COUNT) * i);
  const rightTicks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => (maxRight / TICK_COUNT) * i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Background fill */}
      <rect
        x={PAD.left} y={PAD.top}
        width={iW} height={iH}
        fill="#f8fafb" rx="4"
      />

      {/* Grid lines */}
      {leftTicks.map((v, i) => (
        <line key={i}
          x1={PAD.left} x2={W - PAD.right}
          y1={yPosL(v).toFixed(1)} y2={yPosL(v).toFixed(1)}
          stroke="rgba(0,0,0,0.07)" strokeWidth="1"
          strokeDasharray={i === 0 ? 'none' : '0'}
        />
      ))}

      {/* Left Y axis labels */}
      {leftSeries.length > 0 && leftTicks.map((v, i) => (
        <text key={i}
          x={PAD.left - 8} y={yPosL(v) + 4}
          textAnchor="end" fontSize="11" fill="#9ca3af"
          fontFamily="var(--font-body)"
        >
          {formatRevenue(v)}
        </text>
      ))}

      {/* Right Y axis labels */}
      {rightSeries.length > 0 && rightTicks.map((v, i) => (
        <text key={i}
          x={W - PAD.right + 8} y={yPosR(v) + 4}
          textAnchor="start" fontSize="11" fill="#9ca3af"
          fontFamily="var(--font-body)"
        >
          {Math.round(v)}
        </text>
      ))}

      {/* X axis baseline */}
      <line
        x1={PAD.left} x2={W - PAD.right}
        y1={PAD.top + iH} y2={PAD.top + iH}
        stroke="rgba(0,0,0,0.08)" strokeWidth="1"
      />

      {/* X axis labels */}
      {labels.map((lbl, i) => (
        <text key={i}
          x={xPos(i)} y={H - 10}
          textAnchor="middle" fontSize="11" fill="#9ca3af"
          fontFamily="var(--font-body)"
        >
          {lbl}
        </text>
      ))}

      {/* Series lines */}
      {series.filter(s => activeSeries.includes(s.key)).map(s => {
        const vals = data[s.key];
        const yFn  = s.yAxis === 'left' ? yPosL : yPosR;
        return (
          <g key={s.key}>
            {/* Area fill under line */}
            <defs>
              <linearGradient id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.12" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
              </linearGradient>
            </defs>
            <path
              d={`${makePath(vals, yFn)} L${xPos(vals.length - 1).toFixed(1)},${(PAD.top + iH).toFixed(1)} L${xPos(0).toFixed(1)},${(PAD.top + iH).toFixed(1)} Z`}
              fill={`url(#area-${s.key})`}
            />
            <path
              d={makePath(vals, yFn)}
              fill="none" stroke={s.color} strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            />
            {vals.map((v, i) => (
              <circle key={i}
                cx={xPos(i)} cy={yFn(v)}
                r="3.5" fill={s.color} stroke="#fff" strokeWidth="2"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export default function RevenueChart() {
  const [period, setPeriod]           = useState('Monthly');
  const [activeSeries, setActiveSeries] = useState(['revenue', 'bookings', 'cancellations']);

  const data   = CHART_DATA[period];
  const totRev = data.revenue.reduce((a, b) => a + b, 0);
  const totBk  = data.bookings.reduce((a, b) => a + b, 0);
  const totCx  = data.cancellations.reduce((a, b) => a + b, 0);

  function toggleSeries(key) {
    setActiveSeries(prev =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter(k => k !== key) : prev
        : [...prev, key]
    );
  }

  return (
    <div className="db-table-card" style={{ flexShrink: 0 }}>
      {/* Header */}
      <div className="db-table-card__head" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h2 className="db-table-card__title">Revenue & Booking Trends</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-border)',
                background: period === p ? 'var(--color-brand)' : 'var(--color-surface)',
                color: period === p ? '#fff' : 'var(--color-muted)',
                fontWeight: 600,
                fontSize: '.78rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'background .15s, color .15s',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, padding: '0 20px 14px', flexWrap: 'wrap' }}>
        {SERIES.map(s => (
          <button
            key={s.key}
            onClick={() => toggleSeries(s.key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px',
              borderRadius: 'var(--radius-pill)',
              border: `1.5px solid ${activeSeries.includes(s.key) ? s.color : 'var(--color-border)'}`,
              background: activeSeries.includes(s.key) ? s.color + '15' : 'transparent',
              color: activeSeries.includes(s.key) ? s.color : 'var(--color-muted)',
              fontWeight: 600, fontSize: '.78rem', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              transition: 'all .15s',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
            {s.label}
            <strong style={{ marginLeft: 2 }}>
              {s.key === 'revenue'
                ? formatRevenue(totRev)
                : s.key === 'bookings'
                  ? totBk.toLocaleString()
                  : totCx.toLocaleString()}
            </strong>
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ padding: '0 12px 16px' }}>
        <LineChart
          data={data}
          labels={data.labels}
          series={SERIES}
          activeSeries={activeSeries}
        />
      </div>
    </div>
  );
}