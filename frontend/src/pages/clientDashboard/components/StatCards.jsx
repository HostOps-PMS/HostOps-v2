import React, { useState } from 'react';
import { fmtMoney } from '../../utils/dateHelpers';

const T = {
  fontSora: "'Sora', sans-serif",
  fontDM: "'DM Sans', sans-serif",
  green: '#26a676',
  darkGreen: '#1e8760',
  blue: '#1555C0',
  red: '#c13515',
  text: '#0c1c14',
  muted: '#9ab8a9',
  labelColor: '#6a8b7c',
};

/* ─── Mini Spark Bars ───────────────────────────────────────────── */
function SparkBars({ color }) {
  const heights = [35, 55, 42, 70, 50, 80, 58, 45, 72, 90];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44 }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 5, borderRadius: '3px 3px 0 0',
          height: `${h}%`,
          background: i === heights.length - 1 ? color : `${color}44`,
        }} />
      ))}
    </div>
  );
}

/* ─── Circular Icon ─────────────────────────────────────────────── */
function CircleIcon({ color, bg, children }) {
  return (
    <div style={{
      width: 52, height: 52, borderRadius: '50%',
      background: bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

/* ─── ATM Revenue Card ──────────────────────────────────────────── */
function RevenueCard({ revenue, bookings }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 24,
        background: 'linear-gradient(135deg, #0c2318 0%, #134d2e 55%, #1e8760 100%)',
        padding: '22px 24px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: hovered
          ? '0 16px 48px rgba(30,135,96,.4)'
          : '0 6px 24px rgba(30,135,96,.25)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all .25s ease',
        cursor: 'default',
        minHeight: 190,
      }}
    >
      {/* decorative shapes */}
      <div style={{
        position: 'absolute', bottom: -30, right: -30,
        width: 150, height: 150, background: 'rgba(255,255,255,.05)',
        borderRadius: 28, transform: 'rotate(20deg)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: 30, right: 50,
        width: 90, height: 90, background: 'rgba(255,255,255,.04)',
        borderRadius: 18, transform: 'rotate(10deg)', pointerEvents: 'none',
      }} />

      {/* top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          fontSize: '.65rem', fontWeight: 700, letterSpacing: '1.5px',
          textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', fontFamily: T.fontDM,
        }}>Revenue</div>
        {/* gold chip */}
        <div style={{
          width: 34, height: 26, borderRadius: 5,
          background: 'linear-gradient(135deg, #f5d87a 0%, #c8921a 100%)',
          boxShadow: '0 2px 6px rgba(0,0,0,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 20, height: 14, borderRadius: 2,
            border: '1px solid rgba(180,120,0,.4)',
            background: 'linear-gradient(135deg, rgba(255,220,100,.5), rgba(200,140,20,.3))',
          }} />
        </div>
      </div>

      {/* card number dots */}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {['••••', '••••', '••••', '7310'].map((g, i) => (
          <span key={i} style={{
            fontFamily: T.fontDM, fontSize: '.72rem',
            color: 'rgba(255,255,255,.3)', letterSpacing: '3px',
          }}>{g}</span>
        ))}
      </div>

      {/* amount */}
      <div style={{
        fontFamily: T.fontSora, fontSize: '1.85rem', fontWeight: 800,
        color: '#fff', letterSpacing: '-1.5px', lineHeight: 1.1, marginTop: 10,
      }}>
        {fmtMoney(revenue)}
      </div>

      {/* footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18 }}>
        <div>
          <div style={{ fontSize: '.58rem', color: 'rgba(255,255,255,.35)', fontFamily: T.fontDM, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 2 }}>
            Total Bookings
          </div>
          <div style={{ fontSize: '.9rem', fontWeight: 700, color: 'rgba(255,255,255,.8)', fontFamily: T.fontDM }}>
            {bookings}
          </div>
        </div>
        <div style={{
          fontSize: '.78rem', fontWeight: 800, color: 'rgba(255,255,255,.45)',
          fontFamily: T.fontSora, letterSpacing: '1px',
        }}>
          HostOps
        </div>
      </div>
    </div>
  );
}

/* ─── Split Stat Card ───────────────────────────────────────────── */
function SplitCard({ label, value, sub, color, accentBg, icon }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 20,
        background: '#fff',
        border: `1px solid ${hovered ? color + '33' : '#f0f4f2'}`,
        boxShadow: hovered ? `0 10px 32px ${color}18` : '0 1px 6px rgba(0,0,0,.05)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all .2s ease',
        overflow: 'hidden',
        cursor: 'default',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 190,
      }}
    >
      {/* colored top strip */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

      <div style={{ padding: '18px 20px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* label */}
        <div style={{
          fontSize: '.65rem', fontWeight: 700, letterSpacing: '1px',
          textTransform: 'uppercase', color: T.labelColor, fontFamily: T.fontDM,
          marginBottom: 12,
        }}>
          {label}
        </div>

        {/* split row: number LEFT, icon+chart RIGHT */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
          {/* left: big number */}
          <div>
            <div style={{
              fontFamily: T.fontSora, fontSize: '2.2rem', fontWeight: 800,
              color: color, letterSpacing: '-1.5px', lineHeight: 1,
            }}>
              {value}
            </div>
            <div style={{
              fontSize: '.68rem', color: T.muted,
              fontFamily: T.fontDM, fontWeight: 500, marginTop: 6,
            }}>
              {sub}
            </div>
          </div>

          {/* right: icon circle + sparkbars below */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <CircleIcon color={color} bg={accentBg}>
              {icon}
            </CircleIcon>
            <SparkBars color={color} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main export ───────────────────────────────────────────────── */
export default function StatCards({ stats = {} }) {
  const revenue         = stats.revenue         ?? 0;
  const bookings        = stats.bookings        ?? 0;
  const cancellations   = stats.cancellations   ?? 0;
  const occupancyRate   = stats.occupancyRate   ?? 0;
  const totalNights     = stats.totalNights     ?? 0;
  const cancelledNights = stats.cancelledNights ?? 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.15fr 1fr 1fr 1fr',
      gap: 16,
      marginBottom: 24,
      alignItems: 'stretch',
    }}>
      <RevenueCard revenue={revenue} bookings={bookings} />

      <SplitCard
        label="Bookings"
        value={bookings}
        sub={`${totalNights} nights total`}
        color={T.blue}
        accentBg="#eef3ff"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        }
      />

      <SplitCard
        label="Cancellations"
        value={cancellations}
        sub={`${cancelledNights} nights affected`}
        color={T.red}
        accentBg="#fff0ee"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        }
      />

      <SplitCard
        label="Occupancy Rate"
        value={`${occupancyRate}%`}
        sub="This month"
        color={T.green}
        accentBg="#eaf8f1"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        }
      />
    </div>
  );
}