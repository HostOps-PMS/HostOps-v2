const STATUS_MAP = {
  Completed: 'success',
  Pending:   'warning',
  Cancelled: 'danger',
  Processing:'info',
};

function StatusBadge({ status }) {
  const variant = STATUS_MAP[status] ?? 'neutral';
  const dots = { success: '#26a676', warning: '#f59e0b', danger: '#ef4444', info: '#3b82f6', neutral: '#9ca3af' };
  return (
    <span className={`db-badge db-badge--${variant}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dots[variant], display: 'inline-block' }} />
      {status}
    </span>
  );
}

export default function RecentTable({ orders, loading, onRowClick }) {
  return (
    <div className="db-table-card">
      <div className="db-table-card__head">
        <h2 className="db-table-card__title">Recent Orders</h2>
        <button className="db-table-card__action">View all →</button>
      </div>

      <div className="db-table-wrapper">
        <table className="db-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j}>
                        <div className="db-skeleton" style={{ height: 14, width: j === 1 ? 120 : j === 2 ? 160 : 80 }} />
                      </td>
                    ))}
                  </tr>
                ))
              : orders.map((order) => (
                  <tr key={order.id} onClick={() => onRowClick(order)}>
                    <td style={{ color: 'var(--color-brand)', fontWeight: 600 }}>#{order.id}</td>
                    <td>{order.customer}</td>
                    <td style={{ color: 'var(--color-muted)' }}>{order.product}</td>
                    <td style={{ fontWeight: 600 }}>{order.amount}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td style={{ color: 'var(--color-muted)' }}>{order.date}</td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
