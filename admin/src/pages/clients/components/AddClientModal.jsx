import { useState } from 'react';
import { createClient } from '../services/clientsService';

const INITIAL = {
  businessName:      '',
  email:             '',
  password:          '',
  smoobuApiKey:      '',
};

function Field({ label, required, children }) {
  return (
    <div className="db-field">
      <label>
        {label}
        {required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

export default function AddClientModal({ onClose, onSuccess }) {
  const [form,        setForm]        = useState(INITIAL);
  const [showPass,    setShowPass]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit() {
    if (!form.businessName.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Business name, email, and password are required.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createClient({
        firstName:         form.businessName.trim(), // Storing business name in firstName
        email:             form.email.trim(),
        password:          form.password,
        role:              'client',
        smoobuApiKey:      form.smoobuApiKey.trim() || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err.message ?? 'Failed to create business.');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="db-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="db-modal" style={{ width: 560 }}>
        {/* Header */}
        <div className="db-modal__head">
          <span className="db-modal__title">Add Business</span>
          <button className="db-modal__close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="db-modal__body">
          {/* Error */}
          {error && (
            <div style={{
              background: '#fee2e2', color: '#b91c1c',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px',
              fontSize: '.8125rem', fontWeight: 500,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Business Name */}
          <Field label="Business Name" required>
            <input
              type="text"
              placeholder="Example Business Inc."
              value={form.businessName}
              onChange={set('businessName')}
              maxLength={100}
            />
          </Field>

          {/* Email */}
          <Field label="Email" required>
            <input
              type="email"
              placeholder="contact@example.com"
              value={form.email}
              onChange={set('email')}
              maxLength={254}
            />
          </Field>

          {/* Password */}
          <Field label="Password" required>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={set('password')}
                maxLength={128}
                style={{ width: '100%', paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'var(--color-muted)', cursor: 'pointer',
                  padding: 0, display: 'grid', placeItems: 'center',
                }}
                title={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 3l14 14M10 5C5.5 5 2 10 2 10s1.3 2 3.5 3.5M10 15c4.5 0 8-5 8-5s-1.3-2-3.5-3.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 10s3.5-6 8-6 8 6 8 6-3.5 6-8 6-8-6-8-6z" />
                    <circle cx="10" cy="10" r="2.5" />
                  </svg>
                )}
              </button>
            </div>
          </Field>

          {/* Smoobu API Key */}
          <Field label="Smoobu API Key">
            <input
              type="text"
              placeholder="Optional"
              value={form.smoobuApiKey}
              onChange={set('smoobuApiKey')}
              maxLength={512}
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="db-modal__foot">
          <button className="db-btn db-btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="db-btn db-btn--primary"
            onClick={handleSubmit}
            disabled={submitting}
            style={{ minWidth: 120 }}
          >
            {submitting ? 'Creating…' : 'Add Business'}
          </button>
        </div>
      </div>
    </div>
  );
}
