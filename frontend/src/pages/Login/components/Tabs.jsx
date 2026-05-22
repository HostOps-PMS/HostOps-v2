import React from 'react';

const TABS = [
  { id: 'login', label: 'Sign In' },
  { id: 'register', label: 'Create Account' },
];

export default function Tabs({ active, onChange }) {
  return (
    <div className="lp-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`lp-tab${active === tab.id ? ' active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}