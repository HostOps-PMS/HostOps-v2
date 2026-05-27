import { useState } from 'react';

/* ── Constants ─────────────────────────────────────────────────── */
// Exchange rate: 1 USD = PHP. Update or fetch dynamically as needed.
const USD_TO_PHP = 56.5;

const STATUS_MAP = {
  Completed:  'success',
  Pending:    'warning',
  Cancelled:  'danger',
  Processing: 'info',
};

/* ── Helpers ───────────────────────────────────────────────────── */
function parseAmount(str) {
  // Handles "₱2,400" or "$42.47" → number
  return parseFloat(String(str).replace(/[₱$,\s]/g, '')) || 0;
}

function isUSD(str) {
  return String(str).trim().startsWith('$');
}

function formatPHP(value) {
  return '₱' + value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatUSD(value) {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toPhp(amountStr) {
  const val = parseAmount(amountStr);
  return isUSD(amountStr) ? val * USD_TO_PHP : val;
}

function toUsd(amountStr) {
  const val = parseAmount(amountStr);
  return isUSD(amountStr) ? val : val / USD_TO_PHP;
}

/* ── Sub-components ────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const variant = STATUS_MAP[status] ?? 'neutral';
  const dots = {
    success: '#26a676', warning: '#f59e0b',
    danger: '#ef4444', info: '#3b82f6', neutral: '#9ca3af',
  };
  return (
    <span className={`db-badge db-badge--${variant}`}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: dots[variant], display: 'inline-block',
      }} />
      {status}
    </span>
  );
}

/* ── Currency Modal ────────────────────────────────────────────── */
function CurrencyModal({ orders, onClose }) {
  const [displayCurrency, setDisplayCurrency] = useState('PHP');
  const [customInput,     setCustomInput]     = useState('');

  const customNum  = parseFloat(String(customInput).replace(/,/g, '')) || 0;
  const customPHP  = displayCurrency === 'PHP' ? customNum : customNum * USD_TO_PHP;
  const customUSD  = displayCurrency === 'USD' ? customNum : customNum / USD_TO_PHP;

  return (
    <div
      className="db-modal-overlay"
      style={{ zIndex: 200 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="db-modal" style={{ width: 520 }}>
        {/* Header */}
        <div className="db-modal__head">
          <span className="db-modal__title">Currency Converter</span>
          <button className="db-modal__close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="db-modal__body" style={{ gap: 20 }}>

          {/* Rate info + toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)',
            padding: '10px 14px', fontSize: '.8125rem', color: 'var(--color-muted)',
          }}>
            <span>
              Rate: <strong style={{ color: 'var(--color-text)' }}>1 USD = ₱{USD_TO_PHP.toFixed(2)}</strong>
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {['PHP', 'USD'].map((cur) => (
                <button
                  key={cur}
                  onClick={() => setDisplayCurrency(cur)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--color-border)',
                    background: displayCurrency === cur ? 'var(--color-brand)' : 'var(--color-surface)',
                    color: displayCurrency === cur ? '#fff' : 'var(--color-text)',
                    fontWeight: 600, fontSize: '.8rem', cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    transition: 'background var(--transition), color var(--transition)',
                  }}
                >
                  {cur === 'PHP' ? '₱ PHP' : '$ USD'}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount converter */}
          <div>
            <div style={{
              fontSize: '.75rem', fontWeight: 600, color: 'var(--color-muted)',
              textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8,
            }}>
              Quick Converter
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '.75rem', color: 'var(--color-muted)', marginBottom: 4 }}>
                  {displayCurrency === 'PHP' ? '₱ PHP' : '$ USD'}
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder="Enter amount"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  style={{
                    width: '100%', height: 38, border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)', padding: '0 12px',
                    fontSize: '.875rem', fontFamily: 'var(--font-body)',
                    color: 'var(--color-text)', background: 'var(--color-surface)',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{
                paddingTop: 26, color: 'var(--color-muted)', fontSize: '1.1rem', fontWeight: 300,
              }}>→</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '.75rem', color: 'var(--color-muted)', marginBottom: 4 }}>
                  {displayCurrency === 'PHP' ? '$ USD' : '₱ PHP'}
                </div>
                <div style={{
                  height: 38, border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)', padding: '0 12px',
                  fontSize: '.875rem', fontFamily: 'var(--font-display)',
                  fontWeight: 700, color: 'var(--color-brand)',
                  background: 'var(--color-surface-2)',
                  display: 'flex', alignItems: 'center',
                }}>
                  {customNum > 0
                    ? displayCurrency === 'PHP'
                      ? formatUSD(customUSD)
                      : formatPHP(customPHP)
                    : '—'
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Booking amounts table */}
          <div>
            <div style={{
              fontSize: '.75rem', fontWeight: 600, color: 'var(--color-muted)',
              textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8,
            }}>
              Booking Amounts
            </div>
            <div style={{
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8125rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-2)' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--color-muted)', fontWeight: 600, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      # ID
                    </th>
                    <th style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--color-muted)', fontWeight: 600, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      Guest
                    </th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--color-muted)', fontWeight: 600, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      ₱ PHP
                    </th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--color-muted)', fontWeight: 600, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      $ USD
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, i) => {
                    const php = toPhp(order.amount);
                    const usd = toUsd(order.amount);
                    return (
                      <tr key={order.id} style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : 'none' }}>
                        <td style={{ padding: '9px 14px', color: 'var(--color-brand)', fontWeight: 600 }}>
                          #{order.id}
                        </td>
                        <td style={{ padding: '9px 14px', color: 'var(--color-text)' }}>
                          {order.customer}
                        </td>
                        <td style={{
                          padding: '9px 14px', textAlign: 'right', fontWeight: 700,
                          fontFamily: 'var(--font-display)',
                          color: displayCurrency === 'PHP' ? 'var(--color-text)' : 'var(--color-muted)',
                        }}>
                          {formatPHP(php)}
                        </td>
                        <td style={{
                          padding: '9px 14px', textAlign: 'right', fontWeight: 700,
                          fontFamily: 'var(--font-display)',
                          color: displayCurrency === 'USD' ? 'var(--color-text)' : 'var(--color-muted)',
                        }}>
                          {formatUSD(usd)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                    <td colSpan={2} style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-display)', fontSize: '.8rem' }}>
                      Total
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-brand)' }}>
                      {formatPHP(orders.reduce((sum, o) => sum + toPhp(o.amount), 0))}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-brand)' }}>
                      {formatUSD(orders.reduce((sum, o) => sum + toUsd(o.amount), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="db-modal__foot">
          <span style={{ fontSize: '.75rem', color: 'var(--color-muted)', flex: 1 }}>
            Rate is approximate. Update <code>USD_TO_PHP</code> in RecentTable.jsx for live rates.
          </span>
          <button className="db-btn db-btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────── */
const MAX_ROWS = 10;

export default function RecentTable({ orders, loading, onRowClick }) {
  const [showCurrency, setShowCurrency] = useState(false);

  // Limit display to 10 most recent
  const displayed = orders.slice(0, MAX_ROWS);

  return (
    <>
      {/*
        FIX: Added flex-shrink: 0 so the card is never squished to zero height
        inside the db-content flex column. Also removed overflow: hidden from
        the card itself — clipping is handled by db-table-wrapper instead.
      */}
      <div className="db-table-card" style={{ flexShrink: 0 }}>
        <div className="db-table-card__head">
          <h2 className="db-table-card__title">Recent Bookings</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Currency converter button */}
            {!loading && displayed.length > 0 && (
              <button
                className="db-table-card__action"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '4px 12px',
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  transition: 'border-color var(--transition)',
                }}
                onClick={() => setShowCurrency(true)}
                title="Convert amounts between PHP and USD"
              >
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 8h12M4 12h12" strokeLinecap="round"/>
                  <path d="M9 4l-3 4 3 4M11 8l3 4-3 4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                ₱ / $
              </button>
            )}
            <button className="db-table-card__action">View all →</button>
          </div>
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
                          <div
                            className="db-skeleton"
                            style={{ height: 14, width: j === 1 ? 120 : j === 2 ? 160 : 80 }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                : displayed.length === 0
                  ? (
                    <tr>
                      <td colSpan={6}>
                        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-muted)' }}>
                          <div style={{ fontSize: '2rem', marginBottom: 10, opacity: .4 }}>📋</div>
                          <div style={{ fontSize: '.875rem', fontWeight: 500 }}>No bookings found</div>
                        </div>
                      </td>
                    </tr>
                  )
                  : displayed.map((order) => (
                      <tr key={order.id} onClick={() => onRowClick(order)}>
                        <td style={{ color: 'var(--color-brand)', fontWeight: 600 }}>
                          #{order.id}
                        </td>
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

        {/* Row count footer — only show when there are more than MAX_ROWS */}
        {!loading && orders.length > MAX_ROWS && (
          <div style={{
            padding: '10px 24px',
            borderTop: '1px solid var(--color-border)',
            fontSize: '.8rem',
            color: 'var(--color-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>Showing {MAX_ROWS} of {orders.length} bookings</span>
            <button className="db-table-card__action">View all →</button>
          </div>
        )}
      </div>

      {/* Currency Modal */}
      {showCurrency && (
        <CurrencyModal
          orders={displayed}
          onClose={() => setShowCurrency(false)}
        />
      )}
    </>
  );
}