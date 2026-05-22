import React from 'react';
import { timeAgo } from '../../utils/dateHelpers';
import { getChannelColor, getChannelInitial } from '../utils/channelHelpers';

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
}

/**
 * Unified Inbox panel — shows the latest message thread per guest.
 * Clicking a thread opens the MessageModal.
 */
export default function UnifiedInbox({ inbox = [], totalUnread = 0, onThreadClick }) {
  const badgeStyle = totalUnread > 0
    ? { background: '#fff0ee', color: '#c13515' }
    : { background: '#d4f0e4', color: '#1e8760' };

  return (
    <div className="db-card" style={{ padding: 0 }}>
      <div className="section-head">
        <div>
          <div className="section-head-title">Unified Inbox</div>
          <div className="section-head-sub">Live team monitoring</div>
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
                onClick={() => {
                  if (!thread.reservationId) {
                    alert('This thread has no reservation linked yet.');
                    return;
                  }
                  onThreadClick(thread.reservationId, thread);
                }}
              >
                <div className="inbox-avatar" style={{ background: `${color}22`, color, fontWeight: 700, fontSize: '.85rem' }}>
                  {initial}
                </div>
                <div className="inbox-content">
                  <div className="inbox-top">
                    <span className="inbox-name">{thread.guestName || 'Guest'}</span>
                    <span className={`inbox-time ${statusClass}`}>{timeAgo(ts)}</span>
                  </div>
                  <div className="inbox-prop">{thread.property || ''} · {channel}</div>
                  <div className="inbox-bubble">"{cleanMsg}"</div>
                  <div className={`inbox-status ${statusClass}`}>{statusText}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="inbox-footer">
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