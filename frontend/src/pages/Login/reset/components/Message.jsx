import React from 'react';

/**
 * Message.jsx — success / error message display
 * Props:
 *   text  {string} — message body
 *   type  {'success'|'error'} — controls colour variant
 */
export default function Message({ text, type = 'error' }) {
  if (!text) return null;

  return (
    <div className={`rst-msg ${type}`} role="alert">
      {text}
    </div>
  );
}
