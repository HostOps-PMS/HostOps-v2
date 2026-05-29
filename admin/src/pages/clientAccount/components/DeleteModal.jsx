// src/pages/clientAccount/components/DeleteModal.jsx
import { useState } from 'react';
import { deleteClientAccount } from '../services/clientAccountService';

export default function DeleteModal({ account, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleDelete() {
    setLoading(true);
    setError('');
    try {
      await deleteClientAccount(account._id);
      onDeleted();
    } catch (err) {
      setError(err.message || 'Failed to delete account.');
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box--sm">
        <div className="modal-header">
          <h2 className="modal-title">Delete Client Account</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="modal-error">{error}</div>}
          <p style={{ color: '#374f3c', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Are you sure you want to permanently delete{' '}
            <strong>{account.firstName} {account.lastName || ''}</strong>{' '}
            (<span style={{ color: '#6b8f71' }}>{account.email}</span>)?
            <br />
            <span style={{ color: '#e53e3e', fontSize: '0.82rem' }}>This action cannot be undone.</span>
          </p>
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn--cancel" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="modal-btn modal-btn--danger"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
