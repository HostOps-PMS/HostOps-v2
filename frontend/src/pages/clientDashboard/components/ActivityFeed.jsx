import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { fmtDate, fmtMoney } from '../../utils/dateHelpers';
import { getChannelColor, getChannelInitial } from '../utils/channelHelpers';

/**
 * Live Activity Feed — shows the 3 most recent non-cancelled bookings.
 */
export default function ActivityFeed({ bookings = [], channels = [] }) {
  const { dark } = useDashboard();
  const recent = bookings
    .filter((b) => {
      if (b.type === 'cancellation' || b['is-blocked-booking']) return false;
      if (channels.length > 0) {
        const ch = (b.channel && b.channel.name) || 'Direct';
        if (!channels.includes(ch)) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b['created-at']) - new Date(a['created-at']))
    .slice(0, 3);

  return (
    <div className="db-card" style={{ padding: 0, background: dark ? '#132a1e' : '#fff', border: dark ? '1px solid #1e3a2a' : undefined, transition: 'background 0.2s' }}>
      <div className="section-head" style={{ marginBottom: 0, borderBottom: dark ? '1px solid #1e3a2a' : undefined }}>
        <div>
          <div className="section-head-title" style={{ color: dark ? '#eaf5f0' : undefined }}>Live Activity Feed</div>
          <div className="section-head-sub" style={{ color: dark ? '#4d8a6a' : undefined }}>Recent bookings &amp; events</div>
        </div>
      </div>

      <div className="feed-list">
        {recent.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#9ab8a9', fontSize: '.85rem' }}>
            No recent bookings yet.
          </div>
        ) : (
          recent.map((b, i) => {
            const channel = (b.channel && b.channel.name) || 'Direct';
            const initial = getChannelInitial(channel);
            const color = getChannelColor(channel);
            const nights = Math.max(1, Math.round(
              (new Date(b.departure) - new Date(b.arrival)) / (1000 * 60 * 60 * 24)
            ));
            const createdAt = b['created-at'] || b.createdAt || '';
            const msSince = createdAt ? (Date.now() - new Date(createdAt).getTime()) : 0;
            const daysAgo = Math.floor(msSince / 86400000);
            const timeStr = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;

            return (
              <div key={b.id || i} className="feed-item">
                <div className="feed-row">
                  <div className="feed-left">
                    <div className="feed-avatar" style={{ background: `${color}22`, color, fontWeight: 800, fontSize: '.72rem' }}>
                      {initial}
                    </div>
                    <span className="feed-badge">New booking</span>
                  </div>
                  <div className="feed-stats">
                    <span className="feed-stat">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></svg>
                      {fmtMoney(b.price)}
                    </span>
                    <span className="feed-stat">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
                      {nights} night{nights !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="feed-info">
                  <div className="feed-guest">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ab8a9" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    {b['guest-name'] || 'Guest'}
                  </div>
                  <div className="feed-date">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ab8a9" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    {fmtDate(b.arrival)}
                  </div>
                </div>

                <div className="feed-prop">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                  {b.apartment?.name || 'Property'}
                </div>
                <div className="feed-time">{timeStr}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}