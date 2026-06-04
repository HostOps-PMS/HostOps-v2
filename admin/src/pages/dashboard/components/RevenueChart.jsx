import { useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const RAW = {
  Daily: {
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    revenue:       [42000,58000,51000,67000,73000,89000,61000],
    bookings:      [12,18,15,21,24,30,19],
    cancellations: [1,2,1,3,2,1,2],
  },
  Weekly: {
    labels: ['Wk 1','Wk 2','Wk 3','Wk 4'],
    revenue:       [310000,420000,390000,510000],
    bookings:      [88,112,99,134],
    cancellations: [8,11,7,13],
  },
  Monthly: {
    labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    revenue:       [980000,1120000,1050000,1340000,1280000,1540000,1620000,1480000,1390000,1710000,1850000,2100000],
    bookings:      [310,350,330,410,395,460,490,445,420,510,560,630],
    cancellations: [28,34,30,42,38,45,50,44,39,49,55,61],
  },
  Yearly: {
    labels: ['2020','2021','2022','2023','2024'],
    revenue:       [8500000,10200000,12800000,15400000,18900000],
    bookings:      [2800,3400,4200,5100,6300],
    cancellations: [280,340,410,490,590],
  },
};

const PERIODS = ['Daily','Weekly','Monthly','Yearly'];
const SERIES = [
  { key: 'revenue',       label: 'Revenue (₱)', color: '#1a9e6e', yAxis: 'left' },
  { key: 'bookings',      label: 'Bookings',     color: '#3b82f6', yAxis: 'right' },
  { key: 'cancellations', label: 'Cancellations',color: '#f59e0b', yAxis: 'right' },
];

function formatRevenue(v) {
  if (v >= 1_000_000) return '₱' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return '₱' + (v / 1_000).toFixed(0) + 'K';
  return '₱' + v;
}

function buildData(period) {
  const d = RAW[period];
  return d.labels.map((lbl, i) => ({
    name: lbl,
    revenue:       d.revenue[i],
    bookings:      d.bookings[i],
    cancellations: d.cancellations[i],
  }));
}

export default function RevenueChart() {
  const [period, setPeriod]         = useState('Monthly');
  const [activeSeries, setActive]   = useState(['revenue','bookings','cancellations']);
  const data = buildData(period);

  const totRev = RAW[period].revenue.reduce((a,b) => a+b, 0);
  const totBk  = RAW[period].bookings.reduce((a,b) => a+b, 0);
  const totCx  = RAW[period].cancellations.reduce((a,b) => a+b, 0);

  function toggle(key) {
    setActive(prev =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter(k => k !== key) : prev
        : [...prev, key]
    );
  }

  return (
    <div className="db-table-card" style={{ width: '100%' }}>
      {/* Header */}
      <div className="db-table-card__head" style={{ flexWrap: 'wrap', gap: 6, padding: '10px 14px' }}>
        <h2 className="db-table-card__title">Revenue & Booking Trends</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-border)',
              background: period === p ? 'var(--color-brand)' : 'var(--color-surface)',
              color: period === p ? '#fff' : 'var(--color-muted)',
              fontWeight: 600, fontSize: '.70rem', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Pills */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 20px 10px', flexWrap: 'wrap' }}>
        {SERIES.map(s => {
          const total = s.key === 'revenue' ? formatRevenue(totRev)
                      : s.key === 'bookings' ? totBk.toLocaleString()
                      : totCx.toLocaleString();
          const active = activeSeries.includes(s.key);
          return (
            <button key={s.key} onClick={() => toggle(s.key)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              border: `1.5px solid ${active ? s.color : 'var(--color-border)'}`,
              background: active ? s.color + '15' : 'transparent',
              color: active ? s.color : 'var(--color-muted)',
              fontWeight: 600, fontSize: '.82rem', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
              {s.label} <strong>{total}</strong>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div style={{ padding: '0 8px 12px' }}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 4, right: 36, bottom: 0, left: 48 }}>
            <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" orientation="left"
              tickFormatter={formatRevenue}
              tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
            <YAxis yAxisId="right" orientation="right"
              tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              formatter={(val, name) => name === 'revenue' ? formatRevenue(val) : val}
            />
            {activeSeries.includes('revenue') && (
              <Area yAxisId="left" type="monotone" dataKey="revenue"
                stroke="#1a9e6e" strokeWidth={2} fill="#1a9e6e22" dot={{ r: 3, fill: '#1a9e6e' }} />
            )}
            {activeSeries.includes('bookings') && (
              <Line yAxisId="right" type="monotone" dataKey="bookings"
                stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
            )}
            {activeSeries.includes('cancellations') && (
              <Line yAxisId="right" type="monotone" dataKey="cancellations"
                stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}