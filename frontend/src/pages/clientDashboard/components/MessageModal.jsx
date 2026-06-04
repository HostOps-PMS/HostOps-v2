import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../AuthContext';
import { fetchMessages, sendReply } from '../services/dashboardService';
import { timeAgo, fmtDate } from '../../utils/dateHelpers';
import { getChannelColor, getChannelInitial } from '../utils/channelHelpers';

/* ─── Helpers ────────────────────────────────────────────────────── */
function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
}

/* Decode a JWT payload client-side (no verification — UI gating only).
 * Returns the decoded object, or null on failure. */
function decodeJwt(token) {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64    = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json   = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/* Whether the CURRENT logged-in session is a staff account.
 * Staff are the only accounts allowed to reply. We check every reliable
 * signal available on the client so detection works regardless of which
 * shape the login flow stored:
 *   • JWT  → role === 'staff', or a staffId claim (only staff tokens carry it)
 *   • user → role === 'staff', or a clientId / staffRole field
 *            (Staff records have clientId & staffRole; client / admin /
 *             team_leader User records never do). */
function isStaffSession(auth) {
  const payload = decodeJwt(auth.getToken());
  if (payload) {
    if (payload.role === 'staff') return true;
    if (payload.staffId) return true;
  }
  const u = auth.getUser() || {};
  if (u.role === 'staff') return true;
  if (u.clientId != null && u.clientId !== '') return true;
  if ('staffRole' in u) return true;
  return false;
}

/* ─── Design tokens (inline, no global CSS) ──────────────────────── */
const T = {
  bg: '#fff',
  bgSurface: '#f7faf8',
  bgDeep: '#0c1c14',
  border: '1px solid #eaf0ec',
  borderMid: '1px solid #d8e5de',
  green: '#26a676',
  greenDark: '#1a7a57',
  greenLight: '#e8f7f0',
  text: '#0c1c14',
  muted: '#7a9e8c',
  faint: '#b8d0c4',
  red: '#e84545',
  fontDisplay: "'Sora', sans-serif",
  fontBody: "'DM Sans', sans-serif",
  radius: 20,
  radiusSm: 12,
  radiusPill: 100,
};

/* ─── Channel badge ──────────────────────────────────────────────── */
const CHANNEL_META = {
  Airbnb:          { bg: '#fff0f0', color: '#d93025', label: 'A' },
  'Booking.com':   { bg: '#e8f0fe', color: '#1a73e8', label: 'B' },
  VRBO:            { bg: '#f0eeff', color: '#6741d9', label: 'V' },
  Direct:          { bg: '#e8f7f0', color: '#26a676', label: 'D' },
  'Direct booking':{ bg: '#e8f7f0', color: '#26a676', label: 'D' },
  Agoda:           { bg: '#fff4e8', color: '#e07c2a', label: 'AG' },
  Website:         { bg: '#f0f4f8', color: '#4a6374', label: 'W' },
};

function ChannelBadge({ channel, size = 40 }) {
  const meta = CHANNEL_META[channel] || { bg: '#f0f4f8', color: '#4a6374', label: (channel || 'G')[0] };
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: meta.bg, color: meta.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, fontWeight: 700, fontFamily: T.fontBody,
      flexShrink: 0, letterSpacing: '-0.3px',
    }}>
      {meta.label}
    </div>
  );
}

/* ─── Avatar initials ────────────────────────────────────────────── */
function Avatar({ name, size = 36 }) {
  const initials = (name || 'G').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const hue = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue}, 40%, 88%)`, color: `hsl(${hue}, 40%, 32%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, fontFamily: T.fontBody,
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

/* ─── Close button ───────────────────────────────────────────────── */
function CloseBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 32, height: 32, borderRadius: '50%',
        border: T.border, background: hov ? '#fff4f4' : T.bgSurface,
        color: hov ? T.red : T.muted, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .15s', flexShrink: 0,
      }}
      aria-label="Close"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}

/* ─── Send icon ──────────────────────────────────────────────────── */
function SendIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

/* ─── Spinner icon ───────────────────────────────────────────────── */
function SpinnerIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" strokeDasharray="30 30" strokeDashoffset="0">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ─── List mode: inbox thread item ───────────────────────────────── */
function ThreadItem({ thread, onClick }) {
  const [hov, setHov] = useState(false);
  const ch = thread.channel || 'Direct';
  let preview = stripHtml((thread.latestMessage?.body) || '');
  if (preview.length > 72) preview = preview.slice(0, 72) + '…';
  const ago = timeAgo(thread.latestMessage?.createdAt);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', gap: 12, padding: '14px 20px',
        borderBottom: T.border, cursor: 'pointer',
        background: hov ? T.bgSurface : T.bg,
        transition: 'background .12s',
      }}
    >
      <Avatar name={thread.guestName} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontFamily: T.fontBody, fontWeight: 700, fontSize: 13.5, color: T.text }}>
            {thread.guestName || 'Guest'}
          </span>
          <span style={{ fontFamily: T.fontBody, fontSize: 11, color: T.faint }}>{ago}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <ChannelBadge channel={ch} size={18} />
          <span style={{ fontFamily: T.fontBody, fontSize: 11, color: T.muted }}>
            {thread.property || ''}{thread.property && ch ? ' · ' : ''}{ch}
          </span>
        </div>
        <div style={{ fontFamily: T.fontBody, fontSize: 12.5, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {preview || 'No preview available'}
        </div>
      </div>
    </div>
  );
}

/* ─── Thread view: single message bubble ─────────────────────────── */
function MessageBubble({ msg }) {
  const isIncoming = msg.type === 1 || msg.direction === 'incoming' || msg.from === 'guest';
  const body = stripHtml(msg.message || msg.messageHtml || msg.body || '');
  const date = msg['created-at'] || msg.createdAt || msg.date || '';
  const lines = body.split('\n');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isIncoming ? 'flex-start' : 'flex-end',
      marginBottom: 14,
    }}>
      {msg.subject && (
        <div style={{
          fontFamily: T.fontBody, fontSize: 10.5, fontWeight: 600,
          color: T.faint, marginBottom: 4,
          paddingLeft: isIncoming ? 4 : 0, paddingRight: isIncoming ? 0 : 4,
        }}>
          {msg.subject}
        </div>
      )}
      <div style={{
        maxWidth: '78%',
        padding: '10px 14px',
        borderRadius: isIncoming ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
        background: isIncoming ? T.bgSurface : T.green,
        border: isIncoming ? T.border : 'none',
        fontFamily: T.fontBody, fontSize: 13.5, lineHeight: 1.65,
        color: isIncoming ? T.text : '#fff',
      }}>
        {lines.map((line, j) => (
          <React.Fragment key={j}>
            {line}
            {j < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </div>
      <div style={{
        fontFamily: T.fontBody, fontSize: 10.5, color: T.faint,
        marginTop: 5, paddingLeft: 4, paddingRight: 4,
      }}>
        {isIncoming ? 'Guest' : 'You'}{date ? ' · ' + fmtDate(date) : ''}
      </div>
    </div>
  );
}

/* ─── Main export ────────────────────────────────────────────────── */
export default function MessageModal({
  isOpen,
  onClose,
  reservationId,
  threadInfo,
  inbox = [],
  listMode = false,
  onSelectThread,
}) {
  const auth = useAuth();
  // Reply bar reacts to the CURRENT logged-in user: staff can reply, while
  // team leaders and clients get the read-only notice. Frontend-only — the
  // detection reads the session token / stored user, no backend changes.
  const isStaff = isStaffSession(auth);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const contentRef = useRef(null);
  const textareaRef = useRef(null);

  /* Close on Escape */
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape' && isOpen) onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  /* Load thread */
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
      if (!res?.ok) {
        const errData = res ? await res.json().catch(() => ({})) : {};
        throw new Error(errData.error || 'Failed to load messages');
      }
      const data = await res.json();
      const msgs = Array.isArray(data) ? data : (data.messages || []);
      setMessages(msgs);
      setTimeout(() => {
        if (contentRef.current) contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }, 60);
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
      if (!res?.ok) {
        const err = res ? await res.json().catch(() => ({})) : {};
        throw new Error(err.error || `Send failed (HTTP ${res?.status || '?'})`);
      }
      setReplyText('');
      setTimeout(loadThread, 1200);
    } catch (e) {
      alert('Failed to send reply: ' + e.message);
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  const ch = threadInfo?.channel || 'Direct';
  const guestName = threadInfo?.guestName || 'Guest';

  /* ── Overlay ── */
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(8, 20, 14, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        background: T.bg,
        borderRadius: T.radius,
        width: 580,
        maxWidth: '100%',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 32px 96px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.05)',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 13,
          padding: '16px 20px',
          borderBottom: T.border,
          flexShrink: 0,
        }}>
          {listMode
            ? (
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: T.greenLight, color: T.green,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
              }}>✉</div>
            )
            : <Avatar name={guestName} size={40} />
          }

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: T.fontDisplay, fontWeight: 800,
              fontSize: 15, color: T.text, lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {listMode ? 'All messages' : guestName}
            </div>
            <div style={{
              fontFamily: T.fontBody, fontSize: 12, color: T.muted, marginTop: 2,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {!listMode && (
                <>
                  <ChannelBadge channel={ch} size={16} />
                  <span>{threadInfo?.property || ''}{threadInfo?.property && ch ? ' · ' : ''}{ch}</span>
                </>
              )}
              {listMode && <span>Select a conversation to view and reply</span>}
            </div>
          </div>

          {/* Action pills (thread mode only) */}
          {!listMode && (
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{
                padding: '4px 10px', borderRadius: T.radiusPill,
                background: T.greenLight, color: T.green,
                fontFamily: T.fontBody, fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.green }} />
                Active
              </div>
            </div>
          )}

          <CloseBtn onClick={onClose} />
        </div>

        {/* ── Body ── */}
        {listMode ? (
          /* ── List mode ── */
          <div ref={contentRef} style={{ flex: 1, overflowY: 'auto' }}>
            {inbox.length === 0 ? (
              <div style={{
                padding: '60px 24px', textAlign: 'center',
                fontFamily: T.fontBody, fontSize: 13.5, color: T.faint, lineHeight: 1.7,
              }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>✉</div>
                No messages yet.
              </div>
            ) : (
              inbox.map((t, idx) => (
                <ThreadItem
                  key={idx}
                  thread={t}
                  onClick={() => {
                    if (!t.reservationId) { alert('No reservation linked.'); return; }
                    onSelectThread(t.reservationId, t);
                  }}
                />
              ))
            )}
          </div>
        ) : (
          /* ── Thread mode ── */
          <>
            {/* Messages */}
            <div
              ref={contentRef}
              style={{
                flex: 1, overflowY: 'auto', padding: '20px 22px',
                display: 'flex', flexDirection: 'column',
              }}
            >
              {loading && (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 10, color: T.faint,
                  fontFamily: T.fontBody, fontSize: 13,
                }}>
                  <SpinnerIcon />
                  Loading conversation…
                </div>
              )}

              {error && !loading && (
                <div style={{
                  padding: '40px 20px', textAlign: 'center',
                  fontFamily: T.fontBody, color: T.red, fontSize: 13, lineHeight: 1.7,
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⚠</div>
                  Failed to load conversation.
                  <br />
                  <span style={{ fontSize: 12, color: T.muted }}>{error}</span>
                </div>
              )}

              {!loading && !error && messages.length === 0 && (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 6,
                  fontFamily: T.fontBody, color: T.faint, fontSize: 13, lineHeight: 1.7,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>💬</div>
                  No messages yet.
                  <br />
                  <span style={{ fontSize: 12 }}>Send the first message below.</span>
                </div>
              )}

              {!loading && !error && messages.map((m, i) => (
                <MessageBubble key={i} msg={m} />
              ))}
            </div>

            {/* ── Reply bar (reacts to current logged-in user) ── */}
            {isStaff ? (
              /* ── Staff: interactive reply composer ── */
              <div style={{
                padding: '14px 18px',
                borderTop: T.border,
                background: T.bgSurface,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 10,
                flexShrink: 0,
              }}>
                <textarea
                  ref={textareaRef}
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value);
                    // Auto-grow up to a max height
                    const el = e.target;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                  }}
                  onFocus={() => setReplyFocused(true)}
                  onBlur={() => setReplyFocused(false)}
                  onKeyDown={(e) => {
                    // Enter sends, Shift+Enter inserts a newline
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type your reply…"
                  rows={1}
                  disabled={sending}
                  style={{
                    flex: 1,
                    resize: 'none',
                    maxHeight: 120,
                    minHeight: 42,
                    padding: '11px 14px',
                    borderRadius: T.radiusSm,
                    border: replyFocused ? `1px solid ${T.green}` : T.borderMid,
                    outline: 'none',
                    fontFamily: T.fontBody,
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    color: T.text,
                    background: T.bg,
                    transition: 'border .15s',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !replyText.trim()}
                  style={{
                    height: 42,
                    padding: '0 18px',
                    borderRadius: T.radiusSm,
                    border: 'none',
                    background: (sending || !replyText.trim()) ? T.faint : T.green,
                    color: '#fff',
                    fontFamily: T.fontBody,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: (sending || !replyText.trim()) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    flexShrink: 0,
                    transition: 'background .15s',
                  }}
                >
                  {sending ? <SpinnerIcon /> : <SendIcon />}
                  {sending ? 'Sending' : 'Send'}
                </button>
              </div>
            ) : (
              /* ── Non-staff (team leader / client): read-only notice ── */
              <div style={{
                padding: '14px 20px',
                borderTop: T.border,
                background: T.bgSurface,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: '#fff4e0', color: '#c07d00',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 16,
                }}>
                  🔒
                </div>
                <div>
                  <div style={{
                    fontFamily: T.fontBody, fontWeight: 700,
                    fontSize: 13, color: T.text,
                  }}>
                    Replying is restricted to staff accounts
                  </div>
                  <div style={{
                    fontFamily: T.fontBody, fontSize: 11.5, color: T.muted, marginTop: 2,
                  }}>
                    Only staff members can send messages to guests.
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}