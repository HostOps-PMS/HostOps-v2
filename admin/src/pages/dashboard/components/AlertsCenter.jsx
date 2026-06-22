// components/AlertsCenter.jsx
import { useNavigate } from 'react-router-dom';

// ── Static fallback alerts (shown while loading or no Smoobu data) ──
const FALLBACK_ALERTS = [
  { id: 1, type: 'warning', title: 'Lease Expiring Soon',     desc: 'Haido Ville contract ends in 7 days.',         time: '2m ago',  unread: 0,  avatar: 'HV', avatarBg: '#d97706' },
  { id: 2, type: 'danger',  title: 'Overdue Payment',         desc: 'ABC Resort has an unpaid balance of ₱45,000.', time: '1h ago',  unread: 3,  avatar: 'AR', avatarBg: '#dc2626' },
  { id: 3, type: 'info',    title: 'New Booking Request',     desc: 'Mountain View submitted a new booking.',       time: '3h ago',  unread: 0,  avatar: 'MV', avatarBg: '#2563eb' },
  { id: 4, type: 'success', title: 'Payment Received',        desc: 'Sun Villa paid ₱120,000 successfully.',        time: '5h ago',  unread: 0,  avatar: 'SV', avatarBg: '#059669' },
  { id: 5, type: 'warning', title: 'Occupancy Drop Detected', desc: 'Paradise Inn occupancy fell below 60%.',       time: '1d ago',  unread: 0,  avatar: 'PI', avatarBg: '#d97706' },
];

const ALERT_STYLES = {
  warning: { dot: '#d97706' },
  danger:  { dot: '#dc2626' },
  info:    { dot: '#2563eb' },
  success: { dot: '#059669' },
};

/**
 * @param {object}  props
 * @param {Array}   [props.alerts]   — live alert array from /api/dashboard-overview.
 *                                    If null/undefined, falls back to static list.
 * @param {boolean} [props.loading]
 */
export default function AlertsCenter({ alerts, loading }) {
  const navigate       = useNavigate();
  const displayAlerts  = (!loading && alerts && alerts.length > 0) ? alerts : FALLBACK_ALERTS;
  const isLive         = !loading && alerts && alerts.length > 0;
  const urgentCount    = displayAlerts.filter(a => a.type === 'danger' || a.type === 'warning').length;

  if (loading) {
    return (
      <div className="db-table-card" style={{ flexShrink: 0 }}>
        <div className="db-table-card__head">
          <h2 className="db-table-card__title">Alerts Center</h2>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div className="db-skeleton" style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="db-skeleton" style={{ height: 12, width: '60%', marginBottom: 6 }} />
                <div className="db-skeleton" style={{ height: 10, width: '90%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="db-table-card" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="db-table-card__head" style={{ flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="db-table-card__title">Alerts Center</h2>
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
          <p style={{ fontSize: '.75rem', color: 'var(--color-muted)', marginTop: 2 }}>
            {isLive ? `Auto-generated from Smoobu data` : 'All notifications'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: 'transparent',
            color: '#dc2626',
            border: '1.5px solid #fca5a5',
            fontSize: '.75rem',
            fontWeight: 600,
            padding: '3px 12px',
            borderRadius: 999,
          }}>
            {urgentCount} urgent
          </span>
          <button style={{
            fontSize: '.75rem', color: 'var(--color-muted)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            Today ▾
          </button>
        </div>
      </div>

      {/* Alert rows */}
      <div style={{ padding: '4px 16px 8px', display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: 400 }}>
        {displayAlerts.map((alert, i) => {
          const dot = ALERT_STYLES[alert.type]?.dot ?? '#9ca3af';
          return (
            <div key={alert.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '11px 4px',
              borderBottom: i < displayAlerts.length - 1 ? '1px solid var(--color-border)' : 'none',
              cursor: 'pointer',
            }}>
              {/* Avatar circle */}
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: alert.avatarBg + '22',
                border: `1.5px solid ${alert.avatarBg}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700,
                color: alert.avatarBg,
                flexShrink: 0,
              }}>
                {alert.avatar}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3 }}>
                  {alert.title}
                </div>
                <div style={{
                  fontSize: '.78rem', color: 'var(--color-muted)', marginTop: 3, lineHeight: 1.4,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {alert.desc}
                </div>
                {/* Show client name for live alerts */}
                {isLive && alert.clientName && (
                  <div style={{ fontSize: '.7rem', color: 'var(--color-brand)', marginTop: 2, fontWeight: 600 }}>
                    {alert.clientName}
                  </div>
                )}
              </div>

              {/* Time + unread badge */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: '.72rem', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                  {alert.time}
                </span>
                {alert.unread > 0 && (
                  <span style={{
                    background: '#ef4444', color: '#fff',
                    fontSize: '.65rem', fontWeight: 700,
                    padding: '1px 6px', borderRadius: 999,
                    minWidth: 18, textAlign: 'center',
                  }}>
                    {alert.unread}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state for live mode */}
      {isLive && displayAlerts.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '.8rem' }}>
          No alerts — all properties look healthy.
        </div>
      )}

      {/* View all button */}
      <div style={{ padding: '8px 20px 16px', textAlign: 'center', marginTop: 'auto', flexShrink: 0 }}>
        <button
          onClick={() => navigate('/alerts')}
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
          View all alerts ↗
        </button>
      </div>
    </div>
  );
}
