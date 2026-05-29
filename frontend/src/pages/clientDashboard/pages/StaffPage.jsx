import React from 'react';

export default function StaffPage() {
  return (
    <div className="cs-coming-soon">
      <div className="cs-coming-soon__icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#26a676" strokeWidth="1.8">
          <circle cx="8" cy="8" r="4" />
          <circle cx="18" cy="8" r="4" />
          <path d="M1 21c0-3.314 2.686-6 6-6h2" strokeLinecap="round" />
          <path d="M13 15h4a6 6 0 016 6" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="cs-coming-soon__title">Staff</h1>
      <p className="cs-coming-soon__subtitle">
        Staff management features are on the way. Stay tuned for updates!
      </p>
      <div className="cs-coming-soon__badge">
        <span className="cs-coming-soon__dot" />
        Coming Soon
      </div>
    </div>
  );
}
