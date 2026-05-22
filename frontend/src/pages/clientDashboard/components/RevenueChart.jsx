import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fmtMoney, fmtDateShort } from '../../utils/dateHelpers';

/**
 * Revenue & occupancy combo chart.
 * Expects `data.chartData` — array of { label, revenue, occupancy }.
 * Falls back to sample data when empty.
 */
export default function RevenueChart({ data = {}, period = {} }) {
  const chartData = data.chartData || [];

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
          Occupancy %
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
            <YAxis yAxisId="occ" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ab8a9', fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ border: '1px solid #e3ede8', borderRadius: 10, fontFamily: 'DM Sans', fontSize: 12 }}
              formatter={(value, name) => {
                if (name === 'revenue') return [fmtMoney(value), 'Revenue'];
                return [`${value}%`, 'Occupancy'];
              }}
            />
            <Bar yAxisId="rev" dataKey="revenue" fill="#d4f0e4" radius={[4, 4, 0, 0]} />
            <Line yAxisId="occ" type="monotone" dataKey="occupancy" stroke="#1555C0" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}