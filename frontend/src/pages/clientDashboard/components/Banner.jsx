import React from 'react';

/**
 * Displays a dismissible status bar at the top of the dashboard.
 * @param {string} type  - 'loading' | 'live' | 'error'
 * @param {string} message
 */
export default function Banner({ type, message }) {
  if (!message) return null;

  return (
    <div className={`hp-banner ${type}`}>
      {type === 'live' && (
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#26a676', marginRight: 8 }} />
      )}
      <span dangerouslySetInnerHTML={{ __html: message }} />
    </div>
  );
}
