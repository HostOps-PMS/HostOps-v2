import React from 'react';
import { fmtMoney } from '../../utils/dateHelpers';

/**
 * Renders the 4-column KPI stat grid.
 * Expects `stats` from the API response (data.stats).
 */
export default function StatCards({ stats = {} }) {
  const revenue = stats.revenue ?? 0;
  const bookings = stats.bookings ?? 0;
  const cancellations = stats.cancellations ?? 0;
  const occupancyRate = stats.occupancyRate ?? 0;
  const totalNights = stats.totalNights ?? 0;
  const cancelledNights = stats.cancelledNights ?? 0;

  // Calculate arc endpoint for the gauge
  const gaugeArc = occupancyRate / 100;
  const angle = gaugeArc * Math.PI; // 0 → π
  const x = 10 + 45 * (1 - Math.cos(angle));
  const y = 60 - 45 * Math.sin(angle);
  const largeArc = gaugeArc > 0.5 ? 1 : 0;

  return (
    <div className="db-grid-4">
      {/* Revenue */}
      <div className="db-card stat-box">
        <div className="stat-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#26a676" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
          Revenue
        </div>
        <div className="stat-val">{fmtMoney(revenue)}</div>
        <div className="stat-sub">{totalNights} Nights total</div>
      </div>

      {/* Bookings */}
      <div className="db-card stat-box">
        <div className="stat-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1555C0" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Bookings
        </div>
        <div className="stat-val" style={{ color: '#1555C0' }}>{bookings}</div>
        <div className="stat-sub">{totalNights} Nights total</div>
      </div>

      {/* Cancellations */}
      <div className="db-card stat-box">
        <div className="stat-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c13515" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          Cancellations
        </div>
        <div className="stat-val" style={{ color: '#c13515' }}>{cancellations}</div>
        <div className="stat-sub">{cancelledNights} Nights affected</div>
      </div>

      {/* Occupancy gauge */}
      <div className="db-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 18 }}>
        <div className="stat-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6a8b7c" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Occupancy Rate
        </div>
        <div className="gauge-wrap" style={{ width: '100%', alignItems: 'center' }}>
          <svg width="110" height="66" viewBox="0 0 110 66">
            {/* Track */}
            <path d="M 10 60 A 45 45 0 0 1 100 60" fill="none" stroke="#e3ede8" strokeWidth="10" strokeLinecap="round" />
            {/* Fill — only render if non-zero */}
            {occupancyRate > 0 && (
              <path
                d={`M 10 60 A 45 45 0 ${largeArc} 1 ${x.toFixed(2)} ${y.toFixed(2)}`}
                fill="none"
                stroke="#1555C0"
                strokeWidth="10"
                strokeLinecap="round"
              />
            )}
            <text x="55" y="58" textAnchor="middle" fontFamily="'Sora',sans-serif" fontSize="16" fontWeight="800" fill="#0c1c14">
              {occupancyRate}%
            </text>
          </svg>
        </div>
        <div style={{ fontSize: '.7rem', color: '#9ab8a9', textAlign: 'center', width: '100%' }}>This month</div>
      </div>
    </div>
  );
}