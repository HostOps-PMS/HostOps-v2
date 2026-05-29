// src/pages/clientAccount/components/ClientAccountModal.jsx
import { useState } from 'react';
import { createClientAccount, updateClientAccount } from '../services/clientAccountService';

export default function ClientAccountModal({ mode, account, clients, onClose, onSaved }) {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    parentClientId: account?.parentClientId ? String(account.parentClientId) : '',
    firstName:      account?.firstName  || '',
    lastName:       account?.lastName   || '',
    email:          account?.email      || '',
    password:       '',
    isActive:       account?.isActive   !== false,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setError('');

    if (!form.parentClientId) return setError('Please select a parent client.');
    if (!form.firstName.trim()) return setError('First name is required.');
    if (!form.email.trim())     return setError('Email is required.');
    if (!isEdit && form.password.length < 8) return setError('Password must be at least 8 characters.');

    setSaving(true);
    try {
      if (isEdit) {
        const payload = {
          firstName:   form.firstName,
          lastName:    form.lastName,
          isActive:    form.isActive,
        };
        if (form.password) payload.password = form.password;
        await updateClientAccount(account._id, payload);
      } else {
        await createClientAccount({
          parentClientId: form.parentClientId,
          firstName:      form.firstName,
          lastName:       form.lastName,
          email:          form.email,
          password:       form.password,
        });
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  // Filter to only client-role users for the parent dropdown
  const clientUsers = clients.filter((c) => c.role === 'client');

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? 'Edit Client Account' : 'Create Client Account'}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {error && <div className="modal-error">{error}</div>}

          {/* Parent Client */}
          <div className="modal-field">
            <label className="modal-label">CLIENT (PARENT) *</label>
            <select
              className="modal-input"
              value={form.parentClientId}
              onChange={(e) => set('parentClientId', e.target.value)}
              disabled={isEdit}
            >
              <option value="">— Select a client —</option>
              {clientUsers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.firstName} {c.lastName || ''} — {c.email}
                </option>
              ))}
            </select>
          </div>

          {/* Name row */}
          <div className="modal-row">
            <div className="modal-field">
              <label className="modal-label">FIRST NAME *</label>
              <input
                className="modal-input"
                placeholder="Juan"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">LAST NAME</label>
              <input
                className="modal-input"
                placeholder="Dela Cruz"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
              />
            </div>
          </div>

          {/* Email */}
          <div className="modal-field">
            <label className="modal-label">EMAIL *</label>
            <input
              className="modal-input"
              type="email"
              placeholder="account@example.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              disabled={isEdit}
            />
          </div>

          {/* Password */}
          <div className="modal-field">
            <label className="modal-label">
              {isEdit ? 'NEW PASSWORD (leave blank to keep)' : 'TEMPORARY PASSWORD *'}
            </label>
            <input
              className="modal-input"
              type="password"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <div className="modal-field modal-field--inline">
              <label className="modal-label">STATUS</label>
              <label className="modal-toggle">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => set('isActive', e.target.checked)}
                />
                <span className="modal-toggle__slider" />
                <span className="modal-toggle__label">
                  {form.isActive ? 'Active' : 'Inactive'}
                </span>
              </label>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="modal-btn modal-btn--cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="modal-btn modal-btn--primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}