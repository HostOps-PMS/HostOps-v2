import { useState } from 'react';

/* ── Detail view (read-only) ── */
function DetailView({ data }) {
  const rows = [
    ['Order ID',  `#${data.id}`],
    ['Customer',  data.customer],
    ['Product',   data.product],
    ['Amount',    data.amount],
    ['Status',    data.status],
    ['Date',      data.date],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.875rem' }}>
          <span style={{ color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '.75rem', letterSpacing: '.04em' }}>{label}</span>
          <span style={{ fontWeight: 500 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Create form ── */
function CreateForm() {
  const [form, setForm] = useState({ customer: '', product: '', amount: '', status: 'Pending' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <div className="db-modal__row">
        <div className="db-field">
          <label>Customer</label>
          <input placeholder="Full name" value={form.customer} onChange={set('customer')} />
        </div>
        <div className="db-field">
          <label>Product</label>
          <input placeholder="Product name" value={form.product} onChange={set('product')} />
        </div>
      </div>
      <div className="db-modal__row">
        <div className="db-field">
          <label>Amount</label>
          <input placeholder="₱0.00" value={form.amount} onChange={set('amount')} />
        </div>
        <div className="db-field">
          <label>Status</label>
          <select value={form.status} onChange={set('status')}>
            {['Pending', 'Processing', 'Completed', 'Cancelled'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}

/* ── Modal ── */
export default function Modal({ type, data, onClose }) {
  const isCreate = type === 'create';
  const title    = isCreate ? 'New Record' : `Order #${data?.id}`;

  return (
    <div className="db-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="db-modal">
        <div className="db-modal__head">
          <span className="db-modal__title">{title}</span>
          <button className="db-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="db-modal__body">
          {isCreate ? <CreateForm /> : <DetailView data={data} />}
        </div>

        <div className="db-modal__foot">
          <button className="db-btn db-btn--ghost" onClick={onClose}>
            {isCreate ? 'Cancel' : 'Close'}
          </button>
          {isCreate && (
            <button className="db-btn db-btn--primary" onClick={onClose}>
              Save Record
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
