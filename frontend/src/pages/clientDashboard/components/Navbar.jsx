import React from 'react';

export default function Navbar({ onBackClick }) {
  return (
    <nav className="db-nav">
      <a href="/" className="db-logo">
        <div className="db-logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" style={{ position: 'relative', zIndex: 1, marginBottom: 3 }}>
            <path d="M12 3L2 12h3v8h14v-8h3L12 3z" />
          </svg>
        </div>
        <span className="db-logo-name">HostPilot</span>
      </a>

      <button className="db-back-btn" onClick={onBackClick}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to main
      </button>
    </nav>
  );
}
