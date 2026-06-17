import { useState, useEffect } from 'react';
import { _subscribe } from '../utils/toast';

const CONFIG = {
  success: {
    bg:          '#f0faf5',
    borderColor: '#a8d5be',
    iconBg:      '#d4f0e4',
    iconColor:   '#1e8760',
    title:       'Success',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  error: {
    bg:          '#fff0ee',
    borderColor: '#ffb5aa',
    iconBg:      '#fee2e2',
    iconColor:   '#c13515',
    title:       'Something went wrong.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 8v4" strokeLinecap="round"/>
        <path d="M12 16h.01" strokeLinecap="round" strokeWidth="3"/>
      </svg>
    ),
  },
  info: {
    bg:          '#eff6ff',
    borderColor: '#bfdbfe',
    iconBg:      '#dbeafe',
    iconColor:   '#2563eb',
    title:       'Heads up!',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 16v-4" strokeLinecap="round"/>
        <path d="M12 8h.01" strokeLinecap="round" strokeWidth="3"/>
      </svg>
    ),
  },
};

function ToastItem({ toast: t, onRemove }) {
  const [visible, setVisible] = useState(false);
  const c = CONFIG[t.type] || CONFIG.info;

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 16);
    const hide = setTimeout(() => setVisible(false), t.duration - 320);
    const gone = setTimeout(onRemove, t.duration);
    return () => { clearTimeout(show); clearTimeout(hide); clearTimeout(gone); };
  }, []);

  const dismiss = () => {
    setVisible(false);
    setTimeout(onRemove, 320);
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 18px',
        background: c.bg,
        border: `1px solid ${c.borderColor}`,
        borderRadius: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
        whiteSpace: 'nowrap',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(24px)',
        transition: visible
          ? 'opacity 0.28s ease, transform 0.32s cubic-bezier(0.34,1.56,0.64,1)'
          : 'opacity 0.22s ease, transform 0.22s ease',
      }}
    >
      {/* Icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: c.iconBg, color: c.iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {c.icon}
      </div>

      {/* Text */}
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#0c1c14', margin: 0, lineHeight: 1.3 }}>
          {t.title || c.title}
        </p>
        <p style={{ fontSize: 12, color: '#6a8b7c', margin: 0, lineHeight: 1.4 }}>
          {t.msg}
        </p>
      </div>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: '#9ab8a9', fontSize: 14, padding: '0 0 0 8px', lineHeight: 1,
          fontFamily: 'inherit',
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => _subscribe(t => setToasts(prev => [...prev, t])), []);
  function remove(id) { setToasts(prev => prev.filter(t => t.id !== id)); }

  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem toast={t} onRemove={() => remove(t.id)} />
        </div>
      ))}
    </div>
  );
}
