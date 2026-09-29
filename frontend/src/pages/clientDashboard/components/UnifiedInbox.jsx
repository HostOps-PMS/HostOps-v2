import React from 'react';
import { timeAgo } from '../../utils/dateHelpers';
import { useDashboard } from '../context/DashboardContext';
import { getChannelColor, getChannelInitial } from '../utils/channelHelpers';
import { useActivityLog } from '../hooks/useActivityLog';

// Guest messages are attacker-controlled HTML. DOMParser builds an inert
// document: unlike a detached <div>.innerHTML it never loads <img> or runs
// onerror handlers.
function stripHtml(html) {
  const doc = new DOMParser().parseFromString(String(html ?? ''), 'text/html');
  return (doc.body.textContent || '').trim();
}

/**
 * Unified Inbox panel — shows the latest message thread per guest.
 * Clicking a thread opens the MessageModal.
 */
export default function UnifiedInbox({ inbox = [], totalUnread = 0, onThreadClick }) {
  const { dark } = useDashboard();
  const { logActivity } = useActivityLog();
  const badgeStyle = totalUnread > 0
    ? { background: '#fff0ee', color: '#c13515' }
    : { background: '#d4f0e4', color: '#1e8760' };

  return (
    <div className="db-card" style={{ padding: 0, background: dark ? '#132a1e' : '#fff', border: dark ? '1px solid #1e3a2a' : undefined, transition: 'background 0.2s' }}>
      <div className="section-head" style={{ borderBottom: dark ? '1px solid #1e3a2a' : undefined }}>
        <div>
          <div className="section-head-title" style={{ color: dark ? '#eaf5f0' : undefined }}>Unified Inbox</div>
          <div className="section-head-sub" style={{ color: dark ? '#4d8a6a' : undefined }}>Live team monitoring</div>
        </div>
        <div className="live-badge" style={badgeStyle}>
          <span className="live-dot" />
          {totalUnread > 0 ? `${totalUnread} unread` : 'Live'}
        </div>
      </div>

      <div className="inbox-list">
        {inbox.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#9ab8a9', fontSize: '.85rem' }}>
            No messages yet.
          </div>
        ) : (
          inbox.map((thread, idx) => {
            const channel = thread.channel || 'Direct';
            const color = getChannelColor(channel);
            const initial = getChannelInitial(channel);
            let cleanMsg = stripHtml((thread.latestMessage && thread.latestMessage.body) || '');
            if (cleanMsg.length > 90) cleanMsg = cleanMsg.slice(0, 90) + '…';
            if (!cleanMsg) cleanMsg = 'No preview available';

            const ts = thread.latestMessage?.createdAt;
            const fromGuest = thread.latestMessage?.fromGuest;
            const statusClass = fromGuest ? 'txt-blue' : 'txt-green';
            const statusText = fromGuest ? '⚠ Awaiting your reply' : '↳ Replied to guest';

            return (
              <div
                key={idx}
                className="inbox-item"
                style={{ borderBottom: dark ? '1px solid #1e3a2a' : undefined, background: dark ? '#132a1e' : undefined }}
                onClick={() => {
                  if (!thread.reservationId) {
                    alert('This thread has no reservation linked yet.');
                    return;
                  }
                  logActivity('opened_message_thread', { guest: thread.guestName, property: thread.property });
                  onThreadClick(thread.reservationId, thread);
                }}
              >
                <div className="inbox-avatar" style={{ background: `${color}22`, color, fontWeight: 700, fontSize: '.85rem' }}>
                  {initial}
                </div>
                <div className="inbox-content">
                  <div className="inbox-top">
                    <span className="inbox-name" style={{ color: dark ? '#eaf5f0' : undefined }}>{thread.guestName || 'Guest'}</span>
                    <span className={`inbox-time ${statusClass}`}>{timeAgo(ts)}</span>
                  </div>
                  <div className="inbox-prop" style={{ color: dark ? '#4d8a6a' : undefined }}>{thread.property || ''} · {channel}</div>
                  <div className="inbox-bubble" style={{ color: dark ? '#7aab95' : undefined, background: dark ? '#0f2d1f' : undefined }}>"{cleanMsg}"</div>
                  <div className={`inbox-status ${statusClass}`}>{statusText}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="inbox-footer" style={{ borderTop: dark ? '1px solid #1e3a2a' : undefined, background: dark ? '#0f2d1f' : undefined }}>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#26a676', fontWeight: 700, fontSize: '.78rem', fontFamily: 'inherit' }}
          onClick={() => onThreadClick(null, null, true)}
        >
          View all {inbox.length} message{inbox.length !== 1 ? 's' : ''} →
        </button>
      </div>
    </div>
  );
}