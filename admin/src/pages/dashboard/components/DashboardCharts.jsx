import React, { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function DashboardCharts({ accounts, loading }) {
  const { growthData, statusData } = useMemo(() => {
    if (!accounts || accounts.length === 0) return { growthData: [], statusData: [] };

    // Group for Line Chart (Growth Trend) by Month-Year
    const growthMap = {};
    accounts.forEach(acc => {
      const date = new Date(acc.createdAt);
      const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      
      if (!growthMap[monthYear]) {
        growthMap[monthYear] = { name: monthYear, Businesses: 0, TeamLeaders: 0, Staffs: 0, timestamp: date.getTime() };
      }
      if (acc.role === 'client') growthMap[monthYear].Businesses++;
      else if (acc.role === 'team_leader') growthMap[monthYear].TeamLeaders++;
      else if (acc.role === 'staff') growthMap[monthYear].Staffs++;
    });

    const sortedGrowth = Object.values(growthMap).sort((a, b) => a.timestamp - b.timestamp);

    // Group for Bar Chart (Status Distribution)
    const statusMap = {
      'Locked': 0,
      'Verified': 0,
      'Unverified': 0,
      'Partially Verified': 0,
      'Inactive': 0
    };

    const now = Date.now();
    const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;

    accounts.forEach(acc => {
      const status = (acc.status || 'Unverified').toLowerCase();
      const lastLogin = acc.lastLogin ? new Date(acc.lastLogin).getTime() : 0;
      
      if (status === 'locked') {
        statusMap['Locked']++;
      } else if (lastLogin && (now - lastLogin > FIFTEEN_DAYS)) {
        statusMap['Inactive']++;
      } else if (status === 'verified') {
        statusMap['Verified']++;
      } else if (status === 'partially verified') {
        statusMap['Partially Verified']++;
      } else {
        statusMap['Unverified']++;
      }
    });

    const statusArr = Object.keys(statusMap).map(key => ({
      name: key,
      Count: statusMap[key]
    }));

    return { growthData: sortedGrowth, statusData: statusArr };
  }, [accounts]);

  if (loading) {
    return (
      <div className="db-charts">
        <div className="db-card skeleton" style={{ height: '350px' }}></div>
        <div className="db-card skeleton" style={{ height: '350px' }}></div>
      </div>
    );
  }

  return (
    <div className="db-charts">
      <div className="db-card chart-card">
        <h3 className="db-card__title">Account Growth Trend</h3>
        {growthData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280} minWidth={100} minHeight={100}>
            <LineChart data={growthData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
              <Legend iconType="circle" />
              <Line type="monotone" dataKey="Businesses" stroke="#1d4ed8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="TeamLeaders" stroke="#7e22ce" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Staffs" stroke="#c2410c" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)' }}>
            No growth data available
          </div>
        )}
      </div>

      <div className="db-card chart-card">
        <h3 className="db-card__title">Account Status Distribution</h3>
        <ResponsiveContainer width="100%" height={280} minWidth={100} minHeight={100}>
          <BarChart data={statusData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} barSize={30}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} cursor={{ fill: '#F3F4F6' }} />
            <Bar dataKey="Count" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
