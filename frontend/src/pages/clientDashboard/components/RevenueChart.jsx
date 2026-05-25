import React, { useMemo, useState, useRef, useEffect } from 'react';
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

const QUICK_RANGES = [
  { key: 'ytd',   label: 'Year to date'  },
  { key: 'mtd',   label: 'Month to date' },
  { key: '30d',   label: 'Last 30 days'  },
  { key: '7d',    label: 'Last 7 days'   },
  { key: '1m',    label: 'This month'    },
  { key: 'last1m',label: 'Last month'    },
];

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function getQuickRange(key) {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = now.getMonth();
  if (key === 'ytd')    return { from: new Date(y, 0, 1),          to: now };
  if (key === 'mtd')    return { from: new Date(y, m, 1),          to: now };
  if (key === '30d')    return { from: new Date(now - 30*864e5),   to: now };
  if (key === '7d')     return { from: new Date(now - 7*864e5),    to: now };
  if (key === '1m')     return { from: new Date(y, m, 1),          to: new Date(y, m+1, 0) };
  if (key === 'last1m') return { from: new Date(y, m-1, 1),        to: new Date(y, m, 0) };
  return null;
}

/* ─── Build chart data ──────────────────────────────────────────── */
function buildChartData(bookings, from, to, numProps) {
  if (!bookings.length || !from || !to) return [];

  const fromYear = from.getFullYear();
  const toYear   = to.getFullYear();
  const buckets  = {};

  for (let yr = fromYear; yr <= toYear; yr++) {
    for (let mo = 0; mo < 12; mo++) {
      const key = `${yr}-${String(mo+1).padStart(2,'0')}`;
      buckets[key] = {
        revenue: 0, bookedNights: 0,
        totalNights: new Date(yr, mo+1, 0).getDate() * numProps,
      };
    }
  }

  bookings.forEach(b => {
    if (b.type === 'cancellation') return;
    if (b['is-blocked-booking'])   return;
    const ci = new Date(b.arrival);
    const co = new Date(b.departure);
    const amt = parseFloat(b.price || 0);
    if (isNaN(ci) || isNaN(co)) return;
    if (ci < from || ci > to)   return;
    const key = `${ci.getFullYear()}-${String(ci.getMonth()+1).padStart(2,'0')}`;
    if (buckets[key]) {
      buckets[key].revenue      += amt;
      buckets[key].bookedNights += Math.max(1, Math.round((co - ci) / 86400000));
    }
  });

  return Object.entries(buckets)
    .filter(([key]) => {
      const [yr, mo] = key.split('-').map(Number);
      const d = new Date(yr, mo-1, 1);
      return d >= new Date(from.getFullYear(), from.getMonth(), 1) &&
             d <= new Date(to.getFullYear(),   to.getMonth(),   1);
    })
    .map(([key, v]) => {
      const [, mo] = key.split('-').map(Number);
      return {
        label:     MONTHS[mo-1],
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
function StatPill({ label, value, color, bg }) {
  return (
    <div style={{
      background: bg, borderRadius: 12, padding: '10px 16px',
      display: 'flex', flexDirection: 'column', gap: 2, flex: 1,
    }}>
      <div style={{ fontSize: '.68rem', fontWeight: 700, color, fontFamily: T.fontDM, textTransform: 'uppercase', letterSpacing: '.4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: T.text, fontFamily: T.fontSora }}>
        {value}
      </div>
    </div>
  );
}

/* ─── Filter Popover ────────────────────────────────────────────── */
function FilterPopover({ activeKey, rangeLabel, onQuick, onCustom }) {
  const [open, setOpen]       = useState(false);
  const [custFrom, setCustFrom] = useState(toDateStr(new Date(new Date().getFullYear(), 0, 1)));
  const [custTo,   setCustTo]   = useState(toDateStr(new Date()));
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleQuick(key) {
    onQuick(key);
    setOpen(false);
  }

  function handleApply() {
    if (!custFrom || !custTo) return;
    onCustom(new Date(custFrom), new Date(custTo));
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px',
          border: '1px solid #e3ede8',
          borderRadius: 100,
          fontFamily: T.fontDM,
          fontSize: '.73rem',
          fontWeight: 700,
          color: T.text,
          background: '#fff',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6a8b7c" strokeWidth="2.5" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        {rangeLabel}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="#6a8b7c" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Popover */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: '#fff', border: T.border, borderRadius: 14,
          boxShadow: '0 8px 30px rgba(0,0,0,.10)',
          padding: '12px', zIndex: 9999, minWidth: 240,
          fontFamily: T.fontDM,
        }}>
          {/* Quick ranges */}
          <div style={{ fontSize: '.65rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.5px', padding: '4px 8px 8px' }}>
            Quick Ranges
          </div>
          {QUICK_RANGES.map(r => (
            <button key={r.key} onClick={() => handleQuick(r.key)} style={{
              display: 'block', width: '100%', padding: '9px 12px',
              background: activeKey === r.key ? T.greenBg : 'transparent',
              color:      activeKey === r.key ? T.green   : T.text,
              border: 'none', borderRadius: 8, textAlign: 'left',
              fontFamily: T.fontDM, fontSize: '.85rem', fontWeight: 600,
              cursor: 'pointer', marginBottom: 2,
            }}>
              {r.label}
            </button>
          ))}

          {/* Divider */}
          <div style={{ borderTop: '1px solid #f0f5f2', margin: '10px 0' }} />

          {/* Custom range */}
          <div style={{ fontSize: '.65rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.5px', padding: '0 8px 8px' }}>
            Custom Range
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, padding: '0 4px' }}>
            <input type="date" value={custFrom} onChange={e => setCustFrom(e.target.value)}
              style={{
                flex: 1, padding: '7px 10px', border: '1px solid #e3ede8',
                borderRadius: 8, fontFamily: T.fontDM, fontSize: '.78rem',
                color: T.text, outline: 'none',
              }}
            />
            <input type="date" value={custTo} onChange={e => setCustTo(e.target.value)}
              style={{
                flex: 1, padding: '7px 10px', border: '1px solid #e3ede8',
                borderRadius: 8, fontFamily: T.fontDM, fontSize: '.78rem',
                color: T.text, outline: 'none',
              }}
            />
          </div>
          <button onClick={handleApply} style={{
            width: '100%', padding: '10px', background: T.green,
            color: '#fff', border: 'none', borderRadius: 8,
            fontFamily: T.fontDM, fontSize: '.82rem', fontWeight: 700,
            cursor: 'pointer',
          }}>
            Apply custom range
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Main export ───────────────────────────────────────────────── */
export default function RevenueChart({ data = {}, period = {} }) {
  const bookings   = data.bookings   || [];
  const properties = data.properties || [];
  const numProps   = properties.length || 1;

  const [activeKey,  setActiveKey]  = useState('ytd');
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo,   setCustomTo]   = useState(null);

  const { from, to, rangeLabel } = useMemo(() => {
    if (customFrom && customTo) {
      return {
        from: customFrom, to: customTo,
        rangeLabel: `${fmtDateShort(customFrom.toISOString())} – ${fmtDateShort(customTo.toISOString())}`,
      };
    }
    const range = getQuickRange(activeKey);
    const found = QUICK_RANGES.find(r => r.key === activeKey);
    return {
      from: range?.from || null,
      to:   range?.to   || null,
      rangeLabel: found?.label || 'Year to date',
    };
  }, [activeKey, customFrom, customTo]);

  const chartData = useMemo(
    () => buildChartData(bookings, from, to, numProps),
    [bookings, from, to, numProps]
  );

  const totalRevenue = chartData.reduce((s, d) => s + d.revenue,   0);
  const avgOccupancy = chartData.length
    ? Math.round(chartData.reduce((s, d) => s + d.occupancy, 0) / chartData.length)
    : 0;

  function handleQuick(key) {
    setCustomFrom(null);
    setCustomTo(null);
    setActiveKey(key);
  }

  function handleCustom(f, t) {
    setActiveKey('');
    setCustomFrom(f);
    setCustomTo(t);
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 20, border: T.border,
      boxShadow: T.shadow, padding: '22px 24px', fontFamily: T.fontDM,
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: T.fontSora, fontSize: '1rem', fontWeight: 800, color: T.text, marginBottom: 2 }}>
            Revenue &amp; Occupancy
          </div>
          <div style={{ fontSize: '.75rem', color: T.muted }}>{rangeLabel}</div>
        </div>

        {/* Legend + Filter */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {[{ color: T.green, label: 'Revenue' }, { color: T.blue, label: 'Occupancy %' }].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.72rem', fontWeight: 600, color: T.label }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              {label}
            </div>
          ))}
          <FilterPopover
            activeKey={activeKey}
            rangeLabel={rangeLabel}
            onQuick={handleQuick}
            onCustom={handleCustom}
          />
        </div>
      </div>

      {/* ── Stat Pills ── */}
      {chartData.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <StatPill label="Total Revenue" value={fmtMoney(totalRevenue)} color={T.green} bg={T.greenBg} />
          <StatPill label="Avg Occupancy" value={`${avgOccupancy}%`}     color={T.blue}  bg={T.blueBg}  />
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
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f2" vertical={false} />
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