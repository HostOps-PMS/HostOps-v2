import React, { useState } from 'react';

// Guard lives in a wrapper so every hook in AccountDetailsContent runs
// unconditionally (Rules of Hooks).
export default function AccountDetailsModal(props) {
  if (!props.account) return null;
  return <AccountDetailsContent {...props} />;
}

function AccountDetailsContent({ account, onClose }) {

  const [isDeactivated, setIsDeactivated] = useState(
    (account.status || '').toLowerCase() === 'locked' || 
    (account.status || '').toLowerCase() === 'deactivated'
  );

  const handleUnlock = () => {
    console.log('Unlocking account:', account.id);
    alert('Simulated: Account unlocked successfully.');
  };

  const handleActivate = () => {
    console.log('Activating account:', account.id);
    setIsDeactivated(false);
    alert('Simulated: Account activated successfully.');
  };

  const handleDeactivate = () => {
    console.log('Deactivating account:', account.id);
    setIsDeactivated(true);
    alert('Simulated: Account deactivated successfully.');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="db-modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(12,28,20,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
      <div className="db-modal-content" onClick={e => e.stopPropagation()}>
        <header className="db-modal-header">
          <h2>Account Details</h2>
          <button className="db-modal-close" onClick={onClose}>×</button>
        </header>

        <div className="db-modal-body">
          <div className="detail-row">
            <span className="detail-label">Email:</span>
            <span className="detail-value">{account.email}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Role:</span>
            <span className="detail-value td-role">{account.role.replace('_', ' ')}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Status:</span>
            <span className="detail-value" style={{ textTransform: 'capitalize' }}>
              {account.status || 'Unverified'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Verification:</span>
            <span className="detail-value">{account.verificationStatus || 'Unverified'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Created Date:</span>
            <span className="detail-value">{formatDate(account.createdAt)}</span>
          </div>
        </div>

        <div className="db-modal-footer db-modal-actions">
          {isDeactivated ? (
            <button className="btn-action btn-activate" onClick={handleActivate}>
              Activate
            </button>
          ) : (
            <button className="btn-action btn-deactivate" onClick={handleDeactivate}>
              Deactivate
            </button>
          )}
          <button className="btn-action btn-unlock" onClick={handleUnlock}>
            Unlock Button
          </button>
        </div>
      </div>
    </div>
  );
}
