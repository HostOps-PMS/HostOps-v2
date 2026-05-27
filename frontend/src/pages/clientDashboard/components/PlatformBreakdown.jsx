import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';

const PLATFORM_COLORS = {
  Airbnb: '#FF5A5F',
  'Booking.com': '#1555C0',
  VRBO: '#8b5cf6',
  Direct: '#56c299',
  'Direct booking': '#56c299',
  Agoda: '#8b5cf6',
  Website: '#94a3b8',
};

const META = {
  revenue: {
    label: 'Total revenue',
    fmt: (v) => '₱' + v.toLocaleString(),
    sub: 'this period',
  },
  bookings: {
    label: 'Total bookings',
    fmt: (v) => String(v),
    sub: 'confirmed',
  },
  nights: {
    label: 'Total nights',
    fmt: (v) => String(v),
    sub: 'booked',
  },
};

/* ─── Bar Row ────────────────────────────────────────────────────── */
function BarRow({ ch, color, value, pct, fmtFn, dark }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          fontSize: 12,
          fontFamily: "'DM Sans', sans-serif",
          color: '#6a8b7c',
          width: 110,
          flexShrink: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {ch}
      </div>
      <div
        style={{
          flex: 1,
          height: 7,
          background: dark ? '#1e3a2a' : '#f0f5f2',
          borderRadius: 100,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 100,
            transition: 'width .45s cubic-bezier(.4,0,.2,1)',
          }}
        />
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "'DM Sans', sans-serif",
          color: dark ? '#eaf5f0' : '#0c1c14',
          minWidth: 40,
          textAlign: 'right',
        }}
      >
        {fmtFn(value)}
      </div>
      <div
        style={{
          fontSize: 11,
          fontFamily: "'DM Sans', sans-serif",
          color: '#9ab8a9',
          minWidth: 34,
          textAlign: 'right',
        }}
      >
        {pct}%
      </div>
    </div>
  );
}

/* ─── Stat Box ───────────────────────────────────────────────────── */
function StatBox({ label, value, sub, isLast, dark }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '14px 20px',
        borderRight: isLast ? 'none' : dark ? '1px solid #1e3a2a' : '1px solid #f0f5f2',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontFamily: "'DM Sans', sans-serif",
          color: '#9ab8a9',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          fontFamily: "'Sora', sans-serif",
          color: dark ? '#eaf5f0' : '#0c1c14',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          fontFamily: "'DM Sans', sans-serif",
          color: '#9ab8a9',
          marginTop: 2,
        }}
      >
        {sub}
      </div>
    </div>
  );
}

/* ─── Main export ────────────────────────────────────────────────── */
export default function PlatformBreakdown({ byChannel = {} }) {
  const { dark } = useDashboard();
  const [activeKey, setActiveKey] = useState('revenue');

  const channels = Object.keys(byChannel);

  /* ── Empty state ── */
  if (!channels.length) {
    return (
      <div
        style={{
          background: dark ? '#132a1e' : '#fff',
          borderRadius: 20,
          border: dark ? '1px solid #1e3a2a' : '1px solid #e8f0eb',
          boxShadow: '0 1px 6px rgba(0,0,0,.05)',
          padding: '22px 24px',
        }}
      >
        <div
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: '1rem',
            fontWeight: 800,
            color: '#0c1c14',
            marginBottom: 12,
          }}
        >
          Platform Breakdown
        </div>
        <div
          style={{
            padding: '20px 0',
            textAlign: 'center',
            color: '#9ab8a9',
            fontSize: '.85rem',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          No channel data available.
        </div>
      </div>
    );
  }

  const m = META[activeKey] || META.revenue;
  const sorted = [...channels].sort(
    (a, b) => (byChannel[b][activeKey] || 0) - (byChannel[a][activeKey] || 0)
  );
  const total =
    sorted.reduce((s, ch) => s + (byChannel[ch][activeKey] || 0), 0) || 1;
  const topCh = sorted[0];
  const topPct = Math.round(((byChannel[topCh][activeKey] || 0) / total) * 100);

  const tabKeys = ['revenue', 'bookings', 'nights'];

  return (
    <div
      style={{
        background: dark ? '#132a1e' : '#fff',
        borderRadius: 20,
        border: dark ? '1px solid #1e3a2a' : '1px solid #e8f0eb',
        boxShadow: '0 1px 6px rgba(0,0,0,.05)',
        overflow: 'hidden',
        transition: 'background 0.2s',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '18px 22px 14px',
          borderBottom: dark ? '1px solid #1e3a2a' : '1px solid #f0f5f2',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: '1rem',
              fontWeight: 800,
              color: dark ? '#eaf5f0' : '#0c1c14',
              marginBottom: 2,
            }}
          >
            Platform Breakdown
          </div>
          <div
            style={{
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              color: '#9ab8a9',
            }}
          >
            Revenue · Bookings · Nights
          </div>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            background: dark ? '#0a1f15' : '#f0f5f2',
            borderRadius: 8,
            padding: 3,
          }}
        >
          {tabKeys.map((k) => {
            const on = activeKey === k;
            return (
              <button
                key={k}
                onClick={() => setActiveKey(k)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "'DM Sans', sans-serif",
                  color: on ? (dark ? '#eaf5f0' : '#0c1c14') : '#6a8b7c',
                  background: on ? (dark ? '#1e3a2a' : '#fff') : 'transparent',
                  border: on ? (dark ? '1px solid #2a5c3c' : '1px solid #e8f0eb') : 'none',
                  cursor: 'pointer',
                  transition: 'all .15s',
                  boxShadow: on ? '0 1px 3px rgba(0,0,0,.06)' : 'none',
                }}
              >
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stat row ── */}
      <div
        style={{
          display: 'flex',
          borderBottom: dark ? '1px solid #1e3a2a' : '1px solid #f0f5f2',
          overflow: 'hidden',
        }}
      >
        <StatBox dark={dark} label={m.label} value={m.fmt(total)} sub={m.sub} />
        <StatBox
          dark={dark}
          label="Top channel"
          value={topCh}
          sub={`${topPct}% of ${activeKey}`}
        />
        <StatBox
          dark={dark}
          label="Channels"
          value={channels.length}
          sub="active platforms"
          isLast
        />
      </div>

      {/* ── Bar chart ── */}
      <div style={{ padding: '20px 22px 8px' }}>
        {sorted.map((ch) => {
          const val = byChannel[ch][activeKey] || 0;
          const pct = Math.round((val / total) * 100);
          const color = PLATFORM_COLORS[ch] || '#94a3b8';
          return (
            <BarRow
              key={ch}
              ch={ch}
              color={color}
              value={val}
              pct={pct}
              fmtFn={m.fmt}
              dark={dark}
            />
          );
        })}
      </div>

      {/* ── Legend footer ── */}
      <div
        style={{
          padding: '10px 22px 16px',
          borderTop: dark ? '1px solid #1e3a2a' : '1px solid #f0f5f2',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {channels.map((ch) => (
          <div
            key={ch}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontFamily: "'DM Sans', sans-serif",
              color: '#9ab8a9',
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: PLATFORM_COLORS[ch] || '#94a3b8',
              }}
            />
            {ch}
          </div>
        ))}
      </div>
    </div>
  );
}