import React from 'react';
import { fmtMoney } from '../../utils/dateHelpers';
import { getChannelColor } from '../utils/channelHelpers';

const PLATFORM_COLORS = {
  Airbnb: '#FF5A5F',
  'Booking.com': '#1555C0',
  VRBO: '#8b5cf6',
  Direct: '#56c299',
  'Direct booking': '#56c299',
  Agoda: '#64748b',
  Website: '#94a3b8',
};

function DonutChart({ segments, size = 80 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let cumulative = 0;
  const innerSize = size * 0.675;

  const paths = segments.map((seg, i) => {
    const pct = seg.value / total;
    const start = cumulative;
    cumulative += pct;

    const startAngle = start * 2 * Math.PI - Math.PI / 2;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    const r = size / 2;
    const cx = size / 2;
    const cy = size / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = pct > 0.5 ? 1 : 0;

    return (
      <path
        key={i}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
        fill={seg.color}
      />
    );
  });

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ borderRadius: '50%', overflow: 'hidden' }}>
        {paths}
        <circle cx={size / 2} cy={size / 2} r={innerSize / 2} fill="#fff" />
      </svg>
    </div>
  );
}

/**
 * Platform breakdown section — one donut per metric per channel.
 */
export default function PlatformBreakdown({ byChannel = {} }) {
  const channels = Object.keys(byChannel);

  if (!channels.length) {
    return (
      <div className="db-card">
        <div className="chart-card-title" style={{ marginBottom: 12 }}>Platform Breakdown</div>
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ab8a9', fontSize: '.85rem' }}>
          No channel data available.
        </div>
      </div>
    );
  }

  const totalRevenue = channels.reduce((s, ch) => s + (byChannel[ch].revenue || 0), 0) || 1;
  const totalBookings = channels.reduce((s, ch) => s + (byChannel[ch].bookings || 0), 0) || 1;
  const totalNights = channels.reduce((s, ch) => s + (byChannel[ch].nights || 0), 0) || 1;

  const revSegments = channels.map((ch) => ({ color: PLATFORM_COLORS[ch] || getChannelColor(ch), value: byChannel[ch].revenue || 0 }));
  const bookSegments = channels.map((ch) => ({ color: PLATFORM_COLORS[ch] || getChannelColor(ch), value: byChannel[ch].bookings || 0 }));
  const nightSegments = channels.map((ch) => ({ color: PLATFORM_COLORS[ch] || getChannelColor(ch), value: byChannel[ch].nights || 0 }));

  return (
    <div className="db-card" style={{ padding: 0 }}>
      <div className="section-head">
        <div>
          <div className="chart-card-title">Platform Breakdown</div>
          <div className="chart-card-sub">Revenue · Bookings · Nights</div>
        </div>
      </div>

      <div className="portal-wrap" style={{ padding: '12px 24px 20px' }}>
        {/* Revenue donut */}
        <div className="donut-col">
          <div className="donut-title">Revenue</div>
          <DonutChart segments={revSegments} />
          <div className="donut-legend">
            {channels.map((ch) => (
              <div key={ch}>
                <span className="donut-legend-dot" style={{ background: PLATFORM_COLORS[ch] || getChannelColor(ch) }} />
                {ch}: {Math.round((byChannel[ch].revenue / totalRevenue) * 100)}%
              </div>
            ))}
          </div>
        </div>

        {/* Bookings donut */}
        <div className="donut-col">
          <div className="donut-title">Bookings</div>
          <DonutChart segments={bookSegments} />
          <div className="donut-legend">
            {channels.map((ch) => (
              <div key={ch}>
                <span className="donut-legend-dot" style={{ background: PLATFORM_COLORS[ch] || getChannelColor(ch) }} />
                {ch}: {byChannel[ch].bookings || 0}
              </div>
            ))}
          </div>
        </div>

        {/* Nights donut */}
        <div className="donut-col">
          <div className="donut-title">Nights</div>
          <DonutChart segments={nightSegments} />
          <div className="donut-legend">
            {channels.map((ch) => (
              <div key={ch}>
                <span className="donut-legend-dot" style={{ background: PLATFORM_COLORS[ch] || getChannelColor(ch) }} />
                {ch}: {byChannel[ch].nights || 0}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}