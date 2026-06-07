import React, { useState, useRef, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useDashboardData } from '../hooks/useDashboardData';

/* ─── Date helpers (self-contained, no external dependency) ──── */
function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getRangeForPreset(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'daily': {
      return { from: toYMD(today), to: toYMD(today) };
    }
    case 'weekly': {
      const day = today.getDay(); // 0 = Sun
      const mon = new Date(today);
      mon.setDate(today.getDate() - ((day + 6) % 7)); // Monday
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { from: toYMD(mon), to: toYMD(sun) };
    }
    case 'monthly': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: toYMD(first), to: toYMD(last) };
    }
    case 'yearly': {
      const first = new Date(today.getFullYear(), 0, 1);
      const last  = new Date(today.getFullYear(), 11, 31);
      return { from: toYMD(first), to: toYMD(last) };
    }
    default:
      return null;
  }
}

function fmtShort(ymd) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[+m - 1]} ${+d}, ${y}`;
}

/* ─── Presets config ─────────────────────────────────────────── */
const PRESETS = [
  { id: 'daily',   label: 'Daily' },
  { id: 'weekly',  label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly',  label: 'Yearly' },
  { id: 'custom',  label: 'Custom' },
];

/* ─── Main Component ─────────────────────────────────────────── */
// loadData is called with explicit from/to params so the stale
// useCallback closure is bypassed — safe to call from any instance.
export default function DateFilterBar() {
  const { dashState, updateDashState } = useDashboard();
  const { loadData } = useDashboardData();

  const [activePreset, setActivePreset] = useState('monthly');
  const [showCustomPop, setShowCustomPop] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]   = useState('');

  const popRef = useRef(null);

  // Close popover on outside click
  useEffect(() => {
    function handler(e) {
      if (popRef.current && !popRef.current.contains(e.target)) {
        setShowCustomPop(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handlePreset(preset) {
    if (preset === 'custom') {
      setActivePreset('custom');
      setShowCustomPop(true);
      return;
    }
    setShowCustomPop(false);
    const range = getRangeForPreset(preset);
    if (!range) return;
    setActivePreset(preset);
    updateDashState({ preset, from: range.from, to: range.to });
    // Pass dates explicitly — avoids reading a stale useCallback closure
    loadData(range.from, range.to);
  }

  function applyCustom() {
    if (!customFrom || !customTo) { alert('Please select both dates.'); return; }
    if (customFrom > customTo)    { alert('"From" must be before "To".'); return; }
    setShowCustomPop(false);
    updateDashState({ preset: 'custom', from: customFrom, to: customTo });
    // Pass dates explicitly — avoids reading a stale useCallback closure
    loadData(customFrom, customTo);
  }

  /* active preset label for display */
  const activeLabel = (() => {
    if (activePreset === 'custom' && dashState.from && dashState.to) {
      return `${fmtShort(dashState.from)} – ${fmtShort(dashState.to)}`;
    }
    return PRESETS.find(p => p.id === activePreset)?.label ?? 'Monthly';
  })();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {/* Pill group */}
      <div style={{
        display: 'flex',
        background: '#f0f5f2',
        borderRadius: 12,
        padding: 4,
        gap: 2,
      }}>
        {PRESETS.map(({ id, label }) => {
          const on = activePreset === id;
          return (
            <div
              key={id}
              style={{ position: id === 'custom' ? 'relative' : undefined }}
              ref={id === 'custom' ? popRef : undefined}
            >
              <button
                onClick={() => handlePreset(id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 9,
                  fontSize: '.78rem',
                  fontWeight: 700,
                  fontFamily: "'DM Sans', sans-serif",
                  color: on ? '#0c1c14' : '#6a8b7c',
                  background: on ? '#fff' : 'transparent',
                  border: on ? '1.5px solid #d6ebe0' : '1.5px solid transparent',
                  cursor: 'pointer',
                  transition: 'all .15s',
                  boxShadow: on ? '0 1px 4px rgba(0,0,0,.07)' : 'none',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: id === 'custom' ? 5 : 0,
                }}
              >
                {id === 'custom' && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                )}
                {label}
                {id === 'custom' && on && dashState.from && dashState.to && (
                  <span style={{
                    fontSize: '.72rem',
                    fontWeight: 600,
                    color: '#26a676',
                    marginLeft: 2,
                    maxWidth: 160,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {fmtShort(dashState.from)} – {fmtShort(dashState.to)}
                  </span>
                )}
              </button>

              {/* Custom date popover */}
              {id === 'custom' && showCustomPop && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  background: '#fff',
                  border: '1.5px solid #e3ede8',
                  borderRadius: 14,
                  boxShadow: '0 8px 32px rgba(0,0,0,.12)',
                  padding: '16px',
                  zIndex: 1000,
                  minWidth: 280,
                }}>
                  <div style={{
                    fontSize: '.7rem', fontWeight: 700,
                    color: '#9ab8a9', letterSpacing: '.5px',
                    textTransform: 'uppercase', marginBottom: 10,
                  }}>
                    Custom date range
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    <label style={{ fontSize: '.75rem', color: '#6a8b7c', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                      From
                    </label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={e => setCustomFrom(e.target.value)}
                      style={{
                        padding: '9px 12px',
                        border: '1.5px solid #e3ede8',
                        borderRadius: 9,
                        fontFamily: 'inherit',
                        fontSize: '.82rem',
                        color: '#0c1c14',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                    <label style={{ fontSize: '.75rem', color: '#6a8b7c', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                      To
                    </label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={e => setCustomTo(e.target.value)}
                      style={{
                        padding: '9px 12px',
                        border: '1.5px solid #e3ede8',
                        borderRadius: 9,
                        fontFamily: 'inherit',
                        fontSize: '.82rem',
                        color: '#0c1c14',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setShowCustomPop(false)}
                      style={{
                        flex: 1, padding: '9px', background: '#f0f5f2',
                        color: '#2a4e3c', border: 'none', borderRadius: 9,
                        fontFamily: 'inherit', fontSize: '.8rem', fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={applyCustom}
                      style={{
                        flex: 1, padding: '9px', background: '#26a676',
                        color: '#fff', border: 'none', borderRadius: 9,
                        fontFamily: 'inherit', fontSize: '.8rem', fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
