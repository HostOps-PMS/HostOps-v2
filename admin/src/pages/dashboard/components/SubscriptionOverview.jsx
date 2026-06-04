/* ── Subscription Overview ──────────────────────────────────── */
const PLANS = [
  { name: 'Basic',      clients: 42, color: '#3b82f6' },
  { name: 'Pro',        clients: 61, color: '#1a9e6e' },
  { name: 'Enterprise', clients: 25, color: '#6d28d9' },
];

const SUBS = [
  { name: 'Haido Ville',   plan: 'Enterprise', status: 'Active',   renewal: 'Jul 15, 2025', amount: '₱8,500/mo' },
  { name: 'ABC Resort',    plan: 'Pro',        status: 'Active',   renewal: 'Jun 30, 2025', amount: '₱3,200/mo' },
  { name: 'Mountain View', plan: 'Pro',        status: 'Expiring', renewal: 'Jun 10, 2025', amount: '₱3,200/mo' },
  { name: 'Sun Villa',     plan: 'Basic',      status: 'Active',   renewal: 'Aug 1, 2025',  amount: '₱1,500/mo' },
  { name: 'Paradise Inn',  plan: 'Basic',      status: 'Overdue',  renewal: 'May 1, 2025',  amount: '₱1,500/mo' },
];

/* Neutral status — just text color, no background */
const STATUS_COLOR = {
  Active:   '#059669',
  Expiring: '#d97706',
  Overdue:  '#dc2626',
};

/* Plan badge — subtle border only */
const PLAN_STYLE = {
  Enterprise: { color: '#6d28d9', border: '#ddd6fe' },
  Pro:        { color: '#1a9e6e', border: '#a7f3d0' },
  Basic:      { color: '#2563eb', border: '#bfdbfe' },
};

export default function SubscriptionOverview() {
  const total = PLANS.reduce((a, b) => a + b.clients, 0);

  return (
    <div className="db-table-card" style={{ flexShrink: 0 }}>
      <div className="db-table-card__head">
        <h2 className="db-table-card__title">Subscription Overview</h2>
        <span style={{ fontSize: '.775rem', color: 'var(--color-muted)' }}>{total} total clients</span>
      </div>

      {/* Plan distribution bar */}
      <div style={{ padding: '12px 20px 14px' }}>
        <div style={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', gap: 2, marginBottom: 10 }}>
          {PLANS.map(p => (
            <div key={p.name} style={{ flex: p.clients, background: p.color, borderRadius: 99 }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          {PLANS.map(p => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
              <span style={{ color: 'var(--color-muted)' }}>{p.name}</span>
              <strong style={{ color: 'var(--color-text)' }}>{p.clients}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-2)' }}>
              {['Client', 'Plan', 'Status', 'Renewal', 'Amount'].map(h => (
                <th key={h} style={{
                  padding: '8px 20px', textAlign: 'left',
                  color: 'var(--color-muted)', fontWeight: 600,
                  fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SUBS.map((s, i) => {
              const sc = STATUS_COLOR[s.status] ?? STATUS_COLOR.Active;
              const ps = PLAN_STYLE[s.plan] ?? PLAN_STYLE.Basic;
              return (
                <tr key={s.name} style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : 'none' }}>
                  <td style={{ padding: '10px 20px', fontWeight: 600, color: 'var(--color-text)' }}>{s.name}</td>
                  <td style={{ padding: '10px 20px' }}>
                    <span style={{
                      fontSize: '.7rem', fontWeight: 600,
                      color: ps.color,
                      border: `1px solid ${ps.border}`,
                      padding: '2px 8px', borderRadius: 999,
                      background: 'transparent',
                    }}>
                      {s.plan}
                    </span>
                  </td>
                  <td style={{ padding: '10px 20px' }}>
                    <span style={{
                      fontSize: '.775rem',
                      fontWeight: 600,
                      color: sc,
                    }}>
                      {s.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 20px', color: 'var(--color-muted)', fontSize: '.775rem' }}>{s.renewal}</td>
                  <td style={{ padding: '10px 20px', fontWeight: 700, color: 'var(--color-text)' }}>{s.amount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}