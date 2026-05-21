import React from 'react';

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(12, 28, 20, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999
    }} onClick={onClose}>
      <div className="modal-content" style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '28px',
        maxWidth: '480px',
        width: '90%',
        boxShadow: '0 20px 50px rgba(12, 28, 20, 0.15)',
        position: 'relative'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1c14', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: '#6a8b7c'
          }}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default Modal;
