import React from 'react';

export default function TeamLeaderPage() {
  return (
    <div className="cs-coming-soon">
      <div className="cs-coming-soon__icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#26a676" strokeWidth="1.8">
          <path d="M12 3a5 5 0 100 10 5 5 0 000-10z" />
          <path d="M3 21a9 9 0 0118 0" strokeLinecap="round" />
          <path d="M12 2l1.8 3.6 3.6.6-2.4 2.4.6 3.6-3.6-1.8-3.6 1.8.6-3.6-2.4-2.4 3.6-.6L12 2z" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="cs-coming-soon__title">Team Leader</h1>
      <p className="cs-coming-soon__subtitle">
        Team Leader management features are on the way. Stay tuned for updates!
      </p>
      <div className="cs-coming-soon__badge">
        <span className="cs-coming-soon__dot" />
        Coming Soon
      </div>
    </div>
  );
}
