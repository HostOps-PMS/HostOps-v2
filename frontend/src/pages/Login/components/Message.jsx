import React from 'react';

export default function Message({ text, type }) {
  if (!text) return null;
  return (
    <div className={`lp-msg ${type} show`}>
      {text}
    </div>
  );
}