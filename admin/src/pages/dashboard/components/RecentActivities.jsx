/* ── Recent Activities ──────────────────────────────────────── */
const ACTIVITIES = [
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

export default function RecentActivities() {
  return (
    <div className="db-table-card" style={{ flexShrink: 0 }}>
      <div className="db-table-card__head">
        <h2 className="db-table-card__title">Recent Activities</h2>
        <button className="db-table-card__action">View all →</button>
      </div>

      <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column' }}>
        {ACTIVITIES.map((act, i) => {
          const dot = TYPE_DOT[act.type] ?? TYPE_DOT.booking;
          const avatarBg = hashColor(act.avatar);
          return (
            <div key={act.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 4px',
              borderBottom: i < ACTIVITIES.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}>
              {/* Avatar */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: avatarBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}>
                {act.avatar}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.8rem', color: 'var(--color-text)', lineHeight: 1.4 }}>
                  <strong>{act.actor}</strong>{' '}{act.action}
                </div>
                <div style={{
                  fontSize: '.75rem',
                  color: 'var(--color-muted)',
                  marginTop: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {act.target}
                </div>
              </div>

              {/* Type label (plain text) + time */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 3,
                flexShrink: 0,
              }}>
                <span style={{
                  fontSize: '.7rem',
                  fontWeight: 600,
                  color: dot,
                  textTransform: 'capitalize',
                }}>
                  {act.type}
                </span>
                <span style={{ fontSize: '.7rem', color: 'var(--color-muted)' }}>{act.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}