import { useState } from 'react';
import { deleteClient } from '../../clients/services/clientsService';
import { toast } from '../../../utils/toast';

export default function DeleteModal({ teamLeader, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await deleteClient(teamLeader._id);
      toast.success(`${teamLeader.firstName} ${teamLeader.lastName} has been deleted.`, { title: 'Team Leader Deleted' });
      onDeleted();
    } catch (err) {
      setError(err.message || 'Failed to delete team leader.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(12,28,20,0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 28,
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700 }}>Delete Team Leader</h3>
        <p style={{ margin: '0 0 20px', fontSize: '0.875rem', color: '#718096' }}>
          Are you sure you want to delete <strong>{teamLeader.firstName} {teamLeader.lastName}</strong>? This cannot be undone.
        </p>
        {error && (
          <p style={{ color: '#c13515', fontSize: '0.83rem', marginBottom: 12 }}>{error}</p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px', borderRadius: 8,
              border: '1.5px solid #e2e8f0', background: '#fff',
              color: '#4a5568', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: '9px 20px', borderRadius: 8,
              border: 'none', background: deleting ? '#a0aec0' : '#e53e3e',
              color: '#fff', fontWeight: 600,
              cursor: deleting ? 'not-allowed' : 'pointer', fontSize: '0.875rem',
            }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
