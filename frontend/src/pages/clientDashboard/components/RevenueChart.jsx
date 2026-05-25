import React from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fmtMoney, fmtDateShort } from '../../utils/dateHelpers';

/**
 * Revenue & Bookings combo chart.
 * Expects `data.chartData` — array of { label, revenue, bookings }.
 * Falls back to computing from `data.bookings` when chartData is absent
 * (Smoobu API returns raw bookings only, no pre-aggregated chart payload).
 */

/**
 * Tries multiple common key names to find a pre-built chart array.
 * Returns null if none found so we know to build it from bookings.
 */
function resolvePrebuiltChart(data) {
  const candidates = ['chartData', 'chart', 'revenueChart', 'monthlyData', 'monthly'];
  for (const key of candidates) {
    if (Array.isArray(data[key]) && data[key].length > 0) return data[key];
  }
  return null;
}

/**
 * Builds { label, revenue, bookings }[] from raw bookings array.
 *
 * Revenue  — sum of booking `price` attributed to arrival month,
 *            reservations and modifications only (cancellations excluded).
 * Bookings — count of non-cancelled, non-blocked bookings per arrival month.
 */
function buildChartFromBookings(data) {
  const bookings = data.bookings || [];

  const months = {};

  const ensureMonth = (mk) => {
    if (!months[mk]) months[mk] = { revenue: 0, bookings: 0 };
  };

  bookings.forEach((b) => {
    if (b['is-blocked-booking']) return;
    if (b.type === 'cancellation') return;

    const arrival = new Date(b.arrival);
    if (isNaN(arrival)) return;

    const mk = `${arrival.getFullYear()}-${String(arrival.getMonth() + 1).padStart(2, '0')}`;
    ensureMonth(mk);
    months[mk].revenue += b.price || 0;
    months[mk].bookings += 1;
  });

  if (Object.keys(months).length === 0) return [];

  return Object.keys(months)
    .sort()
    .map((mk) => {
      const [year, month] = mk.split('-').map(Number);
      const label = new Date(year, month - 1, 1).toLocaleString('default', { month: 'short' });
      return { label, revenue: months[mk].revenue, bookings: months[mk].bookings };
    });
}

export default function RevenueChart({ data = {}, period = {} }) {
  const chartData = resolvePrebuiltChart(data) || buildChartFromBookings(data);

  return (
    <div className="db-card">
      <div className="chart-card-title">Revenue &amp; Occupancy</div>
      <div className="chart-card-sub">
        {period.from && period.to
          ? `${fmtDateShort(period.from)} – ${fmtDateShort(period.to)}`
          : 'Year to date'}
      </div>

      <div className="chart-legend">
        <div className="chart-legend-item">
          <div className="chart-legend-dot" style={{ background: '#26a676' }} />
          Revenue
        </div>
        <div className="chart-legend-item">
          <div className="chart-legend-dot" style={{ background: '#1555C0' }} />
          Bookings
        </div>
      </div>

      {chartData.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#9ab8a9', fontSize: '.85rem' }}>
          No chart data available for the selected period.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f2" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ab8a9', fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="rev" orientation="left" tick={{ fontSize: 11, fill: '#9ab8a9', fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="bkg" orientation="right" tick={{ fontSize: 11, fill: '#9ab8a9', fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ border: '1px solid #e3ede8', borderRadius: 10, fontFamily: 'DM Sans', fontSize: 12 }}
              formatter={(value, name) => {
                if (name === 'revenue') return [fmtMoney(value), 'Revenue'];
                return [value, 'Bookings'];
              }}
            />
            <Area
              yAxisId="rev"
              type="monotone"
              dataKey="revenue"
              stroke="#26a676"
              strokeWidth={2}
              fill="#d4f0e4"
              dot={false}
              activeDot={{ r: 4, fill: '#26a676' }}
            />
            <Line
              yAxisId="bkg"
              type="monotone"
              dataKey="bookings"
              stroke="#1555C0"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: '#1555C0' }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}