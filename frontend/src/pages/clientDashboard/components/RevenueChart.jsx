import React, { useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fmtMoney, fmtDateShort } from '../../utils/dateHelpers';

const T = {
  fontSora: "'Sora', sans-serif",
  fontDM:   "'DM Sans', sans-serif",
  green:    '#26a676',
  greenBg:  '#eaf8f1',
  blue:     '#1555C0',
  blueBg:   '#eff4ff',
  text:     '#0c1c14',
  muted:    '#9ab8a9',
  label:    '#6a8b7c',
  border:   '1px solid #e8f0eb',
  shadow:   '0 1px 6px rgba(0,0,0,.05)',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ─── Build chart data ──────────────────────────────────────────── */
function buildChartData(bookings, from, to, numProps) {
  if (!bookings.length || !from || !to) return [];

  const fromYear = from.getFullYear();
  const toYear   = to.getFullYear();
  const buckets  = {};

  for (let yr = fromYear; yr <= toYear; yr++) {
    for (let mo = 0; mo < 12; mo++) {
      const key = `${yr}-${String(mo + 1).padStart(2, '0')}`;
      buckets[key] = {
        revenue: 0, bookedNights: 0,
        totalNights: new Date(yr, mo + 1, 0).getDate() * numProps,
      };
    }
  }

  bookings.forEach(b => {
    if (b.type === 'cancellation') return;
    if (b['is-blocked-booking'])   return;
    const ci  = new Date(b.arrival);
    const co  = new Date(b.departure);
    const amt = parseFloat(b.price || 0);
    if (isNaN(ci) || isNaN(co)) return;
    if (ci < from || ci > to)   return;
    const key = `${ci.getFullYear()}-${String(ci.getMonth() + 1).padStart(2, '0')}`;
    if (buckets[key]) {
      buckets[key].revenue      += amt;
      buckets[key].bookedNights += Math.max(1, Math.round((co - ci) / 86400000));
    }
  });

  return Object.entries(buckets)
    .filter(([key]) => {
      const [yr, mo] = key.split('-').map(Number);
      const d = new Date(yr, mo - 1, 1);
      return d >= new Date(from.getFullYear(), from.getMonth(), 1) &&
             d <= new Date(to.getFullYear(),   to.getMonth(),   1);
    })
    .map(([key, v]) => {
      const [, mo] = key.split('-').map(Number);
      return {
        label:     MONTHS[mo - 1],
        revenue:   Math.round(v.revenue),
        occupancy: v.totalNights > 0
          ? Math.min(100, Math.round((v.bookedNights / v.totalNights) * 100))
          : 0,
      };
    });
}

/* ─── Custom Tooltip ────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: T.border, borderRadius: 12,
      padding: '10px 14px', fontFamily: T.fontDM, fontSize: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,.08)',
    }}>
      <div style={{ fontWeight: 700, color: T.text, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          color: p.name === 'revenue' ? T.green : T.blue,
          fontWeight: 600, marginBottom: 2,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color }} />
          {p.name === 'revenue' ? fmtMoney(p.value) : `${p.value}% Occupancy`}
        </div>
      ))}
    </div>
  );
}

/* ─── Stat Pill ─────────────────────────────────────────────────── */
function StatPill({ label, value, color, bg, dark }) {
  return (
    <div style={{
      background: bg, borderRadius: 12, padding: '10px 16px',
      display: 'flex', flexDirection: 'column', gap: 2, flex: 1,
    }}>
      <div style={{
        fontSize: '.68rem', fontWeight: 700, color,
        fontFamily: T.fontDM, textTransform: 'uppercase', letterSpacing: '.4px',
      }}>
        {label}
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: dark ? '#eaf5f0' : T.text, fontFamily: T.fontSora }}>
        {value}
      </div>
    </div>
  );
}

/* ─── Main export ───────────────────────────────────────────────── */
// period.from and period.to are YYYY-MM-DD strings from the global DateFilterBar.
// No local date filter — all filtering is driven by the top-level DateFilterBar.
export default function RevenueChart({ data = {}, period = {} }) {
  const { dark } = useDashboard();
  const bookings   = data.bookings   || [];
  const properties = data.properties || [];
  const numProps   = properties.length || 1;

  // Convert period strings to Date objects for buildChartData
  const from = useMemo(() => period.from ? new Date(period.from) : null, [period.from]);
  const to   = useMemo(() => period.to   ? new Date(period.to)   : null, [period.to]);

  // Human-readable label for the current period (shown below the title)
  const rangeLabel = useMemo(() => {
    if (period.from && period.to) {
      return `${fmtDateShort(period.from)} – ${fmtDateShort(period.to)}`;
    }
    return 'Selected period';
  }, [period.from, period.to]);

  const chartData = useMemo(
    () => buildChartData(bookings, from, to, numProps),
    [bookings, from, to, numProps]
  );

  const totalRevenue = chartData.reduce((s, d) => s + d.revenue,   0);
  const avgOccupancy = chartData.length
    ? Math.round(chartData.reduce((s, d) => s + d.occupancy, 0) / chartData.length)
    : 0;

  return (
    <div style={{
      background: dark ? '#132a1e' : '#fff',
      borderRadius: 20,
      border: dark ? '1px solid #1e3a2a' : T.border,
      boxShadow: T.shadow, padding: '22px 24px', fontFamily: T.fontDM,
      transition: 'background 0.2s',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: T.fontSora, fontSize: '1rem', fontWeight: 800, color: dark ? '#eaf5f0' : T.text, marginBottom: 2 }}>
            Revenue &amp; Occupancy
          </div>
          <div style={{ fontSize: '.75rem', color: T.muted }}>{rangeLabel}</div>
        </div>

        {/* Legend only — date filter removed, controlled by global DateFilterBar */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {[{ color: T.green, label: 'Revenue' }, { color: T.blue, label: 'Occupancy %' }].map(({ color, label }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: '.72rem', fontWeight: 600, color: T.label,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Stat Pills ── */}
      {chartData.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <StatPill label="Total Revenue" value={fmtMoney(totalRevenue)} color={T.green} bg={dark ? '#1a3d28' : T.greenBg} dark={dark} />
          <StatPill label="Avg Occupancy" value={`${avgOccupancy}%`}     color={T.blue}  bg={dark ? '#1a2a3d' : T.blueBg}  dark={dark} />
        </div>
      )}

      {/* ── Chart ── */}
      {chartData.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: T.muted, fontSize: '.85rem' }}>
          No chart data available for the selected period.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={T.green} stopOpacity={0.18} />
                <stop offset="95%" stopColor={T.green} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1e3a2a" : "#f0f5f2"} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: T.muted, fontFamily: T.fontDM }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              yAxisId="rev" orientation="left"
              tick={{ fontSize: 11, fill: T.muted, fontFamily: T.fontDM }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="occ" orientation="right" domain={[0, 100]}
              tick={{ fontSize: 11, fill: T.muted, fontFamily: T.fontDM }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              yAxisId="rev" type="monotone" dataKey="revenue"
              stroke={T.green} strokeWidth={2.5}
              fill="url(#revGrad)"
              dot={chartData.length === 1 ? { r: 5, fill: T.green, strokeWidth: 0 } : false}
              activeDot={{ r: 5, fill: T.green }}
            />
            <Line
              yAxisId="occ" type="monotone" dataKey="occupancy"
              stroke={T.blue} strokeWidth={2}
              dot={chartData.length === 1 ? { r: 4, fill: T.blue, strokeWidth: 0 } : false}
              activeDot={{ r: 4, fill: T.blue }}
              strokeDasharray="5 3"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}