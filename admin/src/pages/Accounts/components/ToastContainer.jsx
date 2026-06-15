import { useState, useEffect, useRef, useCallback } from 'react';
import { _subscribe } from '../utils/toast';

const CONFIG = {
  success: {
    accent:  '#22c55e',
    iconBg:  '#22c55e',
    iconFg:  '#ffffff',
    title:   'Great success!',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  error: {
    accent:  '#ef4444',
    iconBg:  '#ef4444',
    iconFg:  '#ffffff',
    title:   'Something went wrong.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 8v4" strokeLinecap="round"/>
        <path d="M12 16h.01" strokeLinecap="round" strokeWidth="3"/>
      </svg>
    ),
  },
  info: {
    accent:  '#3b82f6',
    iconBg:  '#3b82f6',
    iconFg:  '#ffffff',
    title:   'Heads up!',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 16v-4" strokeLinecap="round"/>
        <path d="M12 8h.01" strokeLinecap="round" strokeWidth="3"/>
      </svg>
    ),
  },
};

function ProgressBar({ duration, accent, paused }) {
  const [width, setWidth]    = useState(100);
  const remainingRef         = useRef(duration);
  const startRef             = useRef(Date.now());
  const rafRef               = useRef(null);

  useEffect(() => {
    if (paused) {
      cancelAnimationFrame(rafRef.current);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startRef.current));
      return;
    }
    startRef.current = Date.now();
    const tick = () => {
      const left = remainingRef.current - (Date.now() - startRef.current);
      const pct  = Math.max(0, (left / duration) * 100);
      setWidth(pct);
      if (pct > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused, duration]);

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 4,
      background: '#f1f5f9',
    }}>
      <div style={{
        height: '100%',
        width: `${width}%`,
        background: accent,
        transition: paused ? 'none' : 'width 0.1s linear',
      }} />
    </div>
  );
}

function ToastItem({ toast: t, onRemove }) {
  const [phase,  setPhase]  = useState('entering');
  const [paused, setPaused] = useState(false);
  const c = CONFIG[t.type] || CONFIG.info;

  const remainingRef = useRef(t.duration);
  const startTimeRef = useRef(null);
  const t2Ref        = useRef(null);
  const t3Ref        = useRef(null);

  const startTimers = useCallback((ms) => {
    startTimeRef.current = Date.now();
    t2Ref.current = setTimeout(() => setPhase('leaving'), ms - 350);
    t3Ref.current = setTimeout(onRemove, ms);
  }, [onRemove]);

  const stopTimers = useCallback(() => {
    clearTimeout(t2Ref.current);
    clearTimeout(t3Ref.current);
    if (startTimeRef.current) {
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startTimeRef.current));
    }
  }, []);

  useEffect(() => {
    const enter = setTimeout(() => setPhase('visible'), 16);
    startTimers(t.duration);
    return () => { clearTimeout(enter); stopTimers(); };
  }, []);

  const handleMouseEnter = () => { setPaused(true);  stopTimers(); };
  const handleMouseLeave = () => { setPaused(false); startTimers(remainingRef.current); };

  const dismiss = () => {
    stopTimers();
    setPhase('leaving');
    setTimeout(onRemove, 320);
  };

  const transforms = {
    entering: 'translateY(20px) scale(0.96)',
    visible:  'translateY(0)    scale(1)',
    leaving:  'translateY(20px) scale(0.96)',
  };
  const opacities = { entering: 0, visible: 1, leaving: 0 };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '18px 20px 26px 20px',
        minWidth: 340,
        maxWidth: 400,
        background: '#ffffff',
        borderRadius: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        transform: transforms[phase],
        opacity: opacities[phase],
        transition: phase === 'visible'
          ? 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease'
          : 'transform 0.28s cubic-bezier(0.4,0,1,1), opacity 0.22s ease',
      }}
    >
      {/* Circular icon */}
      <div style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        flexShrink: 0,
        background: c.iconBg,
        color: c.iconFg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {c.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.88rem',
          fontWeight: 700,
          color: '#111827',
          marginBottom: 4,
          letterSpacing: '-0.01em',
          lineHeight: 1.3,
        }}>
          {t.title || c.title}
        </div>
        <div style={{
          fontSize: '0.8rem',
          color: '#6b7280',
          lineHeight: 1.55,
          wordBreak: 'break-word',
        }}>
          {t.msg}
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={dismiss}
        style={{
          position: 'absolute',
          top: 12,
          right: 14,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#9ca3af',
          padding: '3px',
          display: 'flex',
          borderRadius: 6,
          transition: 'color 0.13s',
          lineHeight: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#374151'}
        onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
      >
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Progress bar */}
      <ProgressBar duration={t.duration} accent={c.accent} paused={paused} />
    </div>
  );
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => _subscribe(t => setToasts(prev => [...prev, t])), []);

  function remove(id) { setToasts(prev => prev.filter(t => t.id !== id)); }

  return (
    <div style={{
      position: 'fixed',
      bottom: 28,
      right: 28,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: 10,
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
