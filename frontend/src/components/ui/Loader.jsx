import React from 'react';

const Loader = ({ fullScreen = false }) => {
  const loaderContent = (
    <div className="loader-container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="spinner" style={{
        width: '40px',
        height: '40px',
        border: '3px solid #e3ede8',
        borderTop: '3px solid #26a676',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loader-fullscreen" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(234, 248, 241, 0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}>
        {loaderContent}
      </div>
    );
  }

  return loaderContent;
};

export default Loader;
