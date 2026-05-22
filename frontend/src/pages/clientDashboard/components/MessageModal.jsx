import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../AuthContext';
import { fetchMessages, sendReply } from '../services/dashboardService';
import { timeAgo, fmtDate } from '../../utils/dateHelpers';
import { getChannelColor, getChannelInitial } from '../utils/channelHelpers';

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
}

/**
 * Modal that shows a thread of messages and allows replying.
 * Can also be opened in "list mode" to show all inbox threads.
 *
 * Props:
 *  - isOpen: bool
 *  - onClose: fn
 *  - reservationId: string|null
 *  - threadInfo: object|null
 *  - inbox: array (for list mode)
 *  - listMode: bool
 *  - onSelectThread: fn(reservationId, threadInfo)
 */
export default function MessageModal({ isOpen, onClose, reservationId, threadInfo, inbox = [], listMode = false, onSelectThread }) {
  const auth = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const contentRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Load messages when a thread is selected
  useEffect(() => {
    if (!isOpen || listMode || !reservationId) return;
    loadThread();
  }, [isOpen, reservationId, listMode]);

  async function loadThread() {
    setLoading(true);
    setError('');
    setMessages([]);
    setReplyText('');

    try {
      const res = await fetchMessages(reservationId, auth);
      if (!res || !res.ok) {
        const errData = res ? await res.json().catch(() => ({})) : {};
        throw new Error(errData.error || 'Failed to load messages');
      }
      const data = await res.json();
      const msgs = Array.isArray(data) ? data : (data.messages || []);
      setMessages(msgs);

      // Auto-scroll after render
      setTimeout(() => {
        if (contentRef.current) contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }, 50);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    const msg = replyText.trim();
    if (!msg) return;
    setSending(true);

    try {
      const res = await sendReply({ reservationId, subject: 'Re: Your message', messageBody: msg }, auth);
      if (!res || !res.ok) {
        const err = res ? await res.json().catch(() => ({})) : {};
        throw new Error(err.error || `Send failed (HTTP ${res?.status || '?'})`);
      }
      setReplyText('');
      // Reload thread after short delay
      setTimeout(loadThread, 1200);
    } catch (e) {
      alert('Failed to send reply: ' + e.message);
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  const channel = (threadInfo?.channel) || (listMode ? 'Direct' : 'Direct');
  const color = getChannelColor(channel);
  const initial = listMode ? '✉' : getChannelInitial(channel);
  const headerTitle = listMode ? 'All Messages' : (threadInfo?.guestName || 'Guest');
  const headerSub = listMode ? 'Click a conversation to view & reply' : `${threadInfo?.property || ''} · ${channel}`;
  const headerColor = listMode ? '#26a676' : color;

  return (
    <div id="mb-overlay" className="open" onClick={(e) => { if (e.target.id === 'mb-overlay') onClose(); }}>
      <div className="mb-card">
        {/* Header */}
        <div className="mb-header">
          <div className="mb-header-info">
            <div className="mb-header-avatar" style={{ background: `${headerColor}22`, color: headerColor }}>
              {initial}
            </div>
            <div>
              <div className="mb-header-name">{headerTitle}</div>
              <div className="mb-header-sub">{headerSub}</div>
            </div>
          </div>
          <button className="mb-close" onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {listMode ? (
          /* Inbox list */
          <div className="mb-thread" style={{ padding: 0 }} ref={contentRef}>
            {inbox.length === 0 ? (
              <div className="mb-empty">No messages yet.</div>
            ) : (
              <div className="mb-list">
                {inbox.map((t, idx) => {
                  const ch = t.channel || 'Direct';
                  const c = getChannelColor(ch);
                  const i = getChannelInitial(ch);
                  let preview = stripHtml((t.latestMessage && t.latestMessage.body) || '');
                  if (preview.length > 70) preview = preview.slice(0, 70) + '…';

                  return (
                    <div
                      key={idx}
                      className="mb-list-item"
                      onClick={() => {
                        if (!t.reservationId) { alert('No reservation linked.'); return; }
                        onSelectThread(t.reservationId, t);
                      }}
                    >
                      <div className="mb-list-avatar" style={{ background: `${c}22`, color: c }}>{i}</div>
                      <div className="mb-list-content">
                        <div className="mb-list-top">
                          <span className="mb-list-name">{t.guestName || 'Guest'}</span>
                          <span className="mb-list-time">{timeAgo(t.latestMessage?.createdAt)}</span>
                        </div>
                        <div className="mb-list-prop">{t.property || ''} · {ch}</div>
                        <div className="mb-list-preview">{preview || 'No preview'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Thread view */
          <>
            <div className="mb-thread" ref={contentRef}>
              {loading && <div className="mb-loading">Loading conversation…</div>}
              {error && <div className="mb-empty">Failed to load conversation.<br /><span style={{ fontSize: '.78rem' }}>{error}</span></div>}
              {!loading && !error && messages.length === 0 && (
                <div className="mb-empty">No messages in this conversation yet.<br />You can send the first message below.</div>
              )}
              {!loading && !error && messages.map((m, i) => {
                const isIncoming = m.type === 1 || m.direction === 'incoming' || m.from === 'guest';
                const body = stripHtml(m.message || m.messageHtml || m.body || '');
                const date = m['created-at'] || m.createdAt || m.date || '';

                return (
                  <div key={i} className={`mb-msg ${isIncoming ? 'mb-msg-incoming' : 'mb-msg-outgoing'}`}>
                    <div className="mb-msg-bubble">
                      {m.subject && <div className="mb-msg-subject">{m.subject}</div>}
                      {body.split('\n').map((line, j) => (
                        <React.Fragment key={j}>{line}{j < body.split('\n').length - 1 && <br />}</React.Fragment>
                      ))}
                    </div>
                    <div className="mb-msg-meta">
                      {isIncoming ? 'Guest' : 'You'}{date ? ' · ' + fmtDate(date) : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reply area */}
            <div className="mb-reply">
              <textarea
                className="mb-reply-textarea"
                placeholder={`Type your reply to ${threadInfo?.guestName || 'guest'}…`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && replyText.trim()) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={3}
              />
              <div className="mb-reply-actions">
                <span className="mb-reply-hint">Press Ctrl+Enter to send</span>
                <button
                  className="mb-reply-btn"
                  disabled={!replyText.trim() || sending}
                  onClick={handleSend}
                >
                  {sending ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" strokeDasharray="30 30" strokeDashoffset="0">
                        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
                      </circle>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                  {sending ? 'Sending…' : 'Send Reply'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}