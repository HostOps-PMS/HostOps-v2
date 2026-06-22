// components/RecentActivities.jsx
import { useNavigate } from 'react-router-dom';

// ── Static fallback activities (shown while loading or no Smoobu data) ──
const FALLBACK_ACTIVITIES = [
  { id: 1, type: 'booking', actor: 'Maria Santos',  action: 'created a new booking',   target: 'Haido Ville – Room 204',    time: '2m ago',  avatar: 'MS' },
  { id: 2, type: 'payment', actor: 'Sun Villa',     action: 'payment received',         target: '₱120,000',                  time: '15m ago', avatar: 'SV' },
  { id: 3, type: 'cancel',  actor: 'Pedro Lim',     action: 'cancelled booking',        target: 'ABC Resort – Jun 14',       time: '1h ago',  avatar: 'PL' },
  { id: 4, type: 'client',  actor: 'Admin',         action: 'added new client',         target: 'Ocean Breeze Resort',       time: '2h ago',  avatar: 'AD' },
  { id: 5, type: 'booking', actor: 'Ana Reyes',     action: 'updated booking status',   target: 'Mountain View – Completed', time: '3h ago',  avatar: 'AR' },
  { id: 6, type: 'staff',   actor: 'Admin',         action: 'assigned staff',           target: 'Carlo M. → Paradise Inn',   time: '4h ago',  avatar: 'AD' },
  { id: 7, type: 'payment', actor: 'Paradise Inn',  action: 'invoice sent',             target: '₱45,000 – overdue',         time: '5h ago',  avatar: 'PI' },
];

/* Single neutral dot color per type */
const TYPE_DOT = {
  booking: '#2563eb',
  payment: '#059669',
  cancel:  '#dc2626',
  client:  '#1a9e6e',
  staff:   '#7c3aed',
};

const AVATAR_COLORS = ['#1a9e6e','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899','#14b8a6'];

function hashColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/**
 * @param {object}  props
 * @param {Array}   [props.activities]  — live activity array from /api/dashboard-overview.
 *                                       Shape: [{ id, type, actor, action, target, time, avatar, channel, clientName }]
 *                                       If null/undefined, falls back to static list.
 * @param {boolean} [props.loading]
 */
export default function RecentActivities({ activities, loading }) {
  const navigate = useNavigate();
  const displayActivities = (!loading && activities && activities.length > 0)
    ? activities
    : FALLBACK_ACTIVITIES;
  const isLive = !loading && activities && activities.length > 0;

  if (loading) {
    return (
      <div className="db-table-card" style={{ flexShrink: 0 }}>
        <div className="db-table-card__head">
          <h2 className="db-table-card__title">Recent Activities</h2>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div className="db-skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="db-skeleton" style={{ height: 11, width: '70%', marginBottom: 6 }} />
                <div className="db-skeleton" style={{ height: 10, width: '50%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="db-table-card" style={{ flexShrink: 0, minHeight: 450, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="db-table-card__head" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="db-table-card__title">Recent Activities</h2>
          {isLive && (
            <span style={{
              fontSize: '.68rem', fontWeight: 700,
              color: '#059669', background: '#d1fae5',
              border: '1px solid #6ee7b7',
              padding: '2px 8px', borderRadius: 999,
            }}>
              ● Live
            </span>
          )}
        </div>
        <button className="db-table-card__action" onClick={() => navigate('/recent-activities')}>View all →</button>
      </div>

      {/* Activity list */}
      <div style={{ padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: 400 }}>
        {displayActivities.map((act, i) => {
          const dot      = TYPE_DOT[act.type] ?? TYPE_DOT.booking;
          const avatarBg = hashColor(act.avatar || act.actor || 'G');
          return (
            <div key={act.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 4px',
              borderBottom: i < displayActivities.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}>
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: avatarBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {act.avatar || (act.actor || 'G').slice(0, 2).toUpperCase()}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.8rem', color: 'var(--color-text)', lineHeight: 1.4 }}>
                  <strong>{act.actor}</strong>{' '}{act.action}
                </div>
                <div style={{
                  fontSize: '.75rem', color: 'var(--color-muted)', marginTop: 1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {act.target}
                </div>
                {/* Show client name for live activities */}
                {isLive && act.clientName && (
                  <div style={{ fontSize: '.7rem', color: 'var(--color-brand)', marginTop: 1, fontWeight: 600 }}>
                    {act.clientName}
                    {act.channel && act.channel !== 'Direct' && (
                      <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}> · {act.channel}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Type label + time */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                <span style={{ fontSize: '.7rem', fontWeight: 600, color: dot, textTransform: 'capitalize' }}>
                  {act.type}
                </span>
                <span style={{ fontSize: '.7rem', color: 'var(--color-muted)' }}>{act.time}</span>
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {isLive && displayActivities.length === 0 && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-muted)', fontSize: '.8rem' }}>
            No recent booking activity.
          </div>
        )}
      </div>

      {/* View all button — bottom */}
      <div style={{ padding: '20px 20px 24px', textAlign: 'center', marginTop: 'auto', flexShrink: 0 }}>
        <button
          onClick={() => navigate('/recent-activities')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 24px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-brand-light)',
            color: 'var(--color-brand)',
            fontWeight: 600, fontSize: '.8rem',
            border: '1px solid #c6ead9',
            cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
          View all activities ↗
        </button>
      </div>
    </div>
  );
}
