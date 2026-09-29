import React, { useState, useRef, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useActivityLog } from '../hooks/useActivityLog';

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
  const { dashState, updateDashState, dark } = useDashboard();
  const { loadData } = useDashboardData();
  const { logActivity } = useActivityLog();

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
    loadData(range.from, range.to);
    logActivity('changed_dashboard_period', { period: preset });
  }

  function applyCustom() {
    if (!customFrom || !customTo) { alert('Please select both dates.'); return; }
    if (customFrom > customTo)    { alert('"From" must be before "To".'); return; }
    setShowCustomPop(false);
    updateDashState({ preset: 'custom', from: customFrom, to: customTo });
    loadData(customFrom, customTo);
    logActivity('changed_dashboard_period', { period: 'custom', from: customFrom, to: customTo });
  }

  /* active preset label for display */
  const activeLabel = (() => {
    if (activePreset === 'custom' && dashState.from && dashState.to) {
      return `${fmtShort(dashState.from)} – ${fmtShort(dashState.to)}`;
    }
    return PRESETS.find(p => p.id === activePreset)?.label ?? 'Monthly';
  })();

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .dfb-outer {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            gap: 6px !important;
          }
          .dfb-presets-row {
            display: flex !important;
            width: 100% !important;
            background: ${dark ? '#0a1f15' : '#f0f5f2'} !important;
            border-radius: 12px !important;
            padding: 4px !important;
            gap: 2px !important;
          }
          .dfb-presets-row > div {
            flex: 1 !important;
          }
          .dfb-presets-row button {
            width: 100% !important;
            justify-content: center !important;
            padding: 7px 2px !important;
            font-size: .7rem !important;
          }
          .dfb-custom-row {
            width: 100% !important;
            position: relative !important;
          }
          .dfb-custom-row button {
            width: 100% !important;
            justify-content: center !important;
            background: ${dark ? '#0a1f15' : '#f0f5f2'} !important;
            border-radius: 12px !important;
            padding: 8px 14px !important;
            font-size: .78rem !important;
          }
          .dfb-custom-pop {
            position: absolute !important;
            top: calc(100% + 8px) !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            min-width: unset !important;
            box-sizing: border-box !important;
            z-index: 9999 !important;
          }
          .dfb-pop-overlay {
            display: block !important;
          }
        }
        .dfb-custom-row .dfb-apply-btn,
        .dfb-custom-pop .dfb-apply-btn,
        button.dfb-apply-btn {
          background-color: #26a676 !important;
          background: #26a676 !important;
          color: #ffffff !important;
          opacity: 1 !important;
          -webkit-appearance: none !important;
          appearance: none !important;
          border: none !important;
          box-shadow: none !important;
          filter: none !important;
        }
        .dfb-apply-btn:disabled {
          background-color: #26a676 !important;
          background: #26a676 !important;
          opacity: 1 !important;
        }
        input[type="date"]::-webkit-calendar-picker-indicator {
          opacity: 0 !important;
          position: absolute !important;
          right: 0 !important;
          width: 40px !important;
          height: 100% !important;
          cursor: pointer !important;
        }
        input[type="date"] {
          position: relative !important;
        }
      `}</style>

      <div className="dfb-outer" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>

        {/* Row 1: Daily / Weekly / Monthly / Yearly */}
        <div className="dfb-presets-row" style={{
          display: 'flex',
          background: dark ? '#0a1f15' : '#f0f5f2',
          borderRadius: 12,
          padding: 4,
          gap: 2,
        }}>
          {PRESETS.filter(p => p.id !== 'custom').map(({ id, label }) => {
            const on = activePreset === id;
            return (
              <div key={id}>
                <button
                  onClick={() => handlePreset(id)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 9,
                    fontSize: '.78rem',
                    fontWeight: 700,
                    fontFamily: "'DM Sans', sans-serif",
                    color: on ? (dark ? '#eaf5f0' : '#0c1c14') : (dark ? '#6aab8a' : '#6a8b7c'),
                    background: on ? (dark ? '#1a3d28' : '#fff') : 'transparent',
                    border: on ? `1.5px solid ${dark ? '#2a5c3c' : '#d6ebe0'}` : '1.5px solid transparent',
                    cursor: 'pointer',
                    transition: 'all .15s',
                    boxShadow: on ? '0 1px 4px rgba(0,0,0,.07)' : 'none',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {label}
                </button>
              </div>
            );
          })}
        </div>

        {/* Row 2: Custom */}
        <div className="dfb-custom-row" ref={popRef} style={{ position: 'relative' }}>
          <button
            onClick={() => handlePreset('custom')}
            style={{
              padding: '7px 14px',
              borderRadius: 9,
              fontSize: '.78rem',
              fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
              color: activePreset === 'custom' ? (dark ? '#eaf5f0' : '#0c1c14') : (dark ? '#6aab8a' : '#6a8b7c'),
              background: activePreset === 'custom' ? (dark ? '#1a3d28' : '#fff') : (dark ? '#0a1f15' : '#f0f5f2'),
              border: activePreset === 'custom' ? `1.5px solid ${dark ? '#2a5c3c' : '#d6ebe0'}` : '1.5px solid transparent',
              cursor: 'pointer',
              transition: 'all .15s',
              boxShadow: activePreset === 'custom' ? '0 1px 4px rgba(0,0,0,.07)' : 'none',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Custom
            {activePreset === 'custom' && dashState.from && dashState.to && (
              <span style={{
                fontSize: '.72rem', fontWeight: 600, color: '#26a676',
                marginLeft: 2, maxWidth: 160,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {fmtShort(dashState.from)} – {fmtShort(dashState.to)}
              </span>
            )}
          </button>

          {/* Blurred overlay — mobile only */}
          {showCustomPop && (
            <div
              className="dfb-pop-overlay"
              onClick={() => setShowCustomPop(false)}
              style={{
                display: 'none',
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.25)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                zIndex: 9998,
              }}
            />
          )}

          {/* Popover */}
          {showCustomPop && (
            <div className="dfb-custom-pop" style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              background: dark ? '#132a1e' : '#fff',
              border: dark ? '1.5px solid #1e3a2a' : '1.5px solid #e3ede8',
              borderRadius: 14,
              boxShadow: '0 8px 32px rgba(0,0,0,.18)',
              padding: '16px',
              zIndex: 1000,
              minWidth: 280,
            }}>
              {/* Header with X button */}
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 10,
                gap: 8,
              }}>
                <div style={{
                  fontSize: '.7rem', fontWeight: 700, color: dark ? '#6aab8a' : '#9ab8a9',
                  letterSpacing: '.5px', textTransform: 'uppercase',
                  flex: 1,
                }}>
                  Custom date range
                </div>
                <button
                  onClick={() => setShowCustomPop(false)}
                  style={{
                    border: 'none',
                    background: '#f0f5f2',
                    flex: 'none',
                    cursor: 'pointer',
                    color: '#9ab8a9',
                    fontSize: '.75rem',
                    lineHeight: 1,
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    flexShrink: 0,
                    outline: 'none',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    borderRadius: '50%',
                  }}
                >✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                <label style={{ fontSize: '.75rem', color: dark ? '#9ab8a9' : '#6a8b7c', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>From</label>
                <input
                  type="date" value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  style={{ padding: '9px 12px', border: dark ? '1.5px solid #2a5c3c' : '1.5px solid #e3ede8', borderRadius: 9, fontFamily: 'inherit', fontSize: '.82rem', color: dark ? '#eaf5f0' : '#0c1c14', outline: 'none', width: '100%', boxSizing: 'border-box', minHeight: 44, display: 'block', backgroundColor: dark ? '#0f2d1f' : '#fff', colorScheme: dark ? 'dark' : 'light', WebkitAppearance: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236a8b7c' stroke-width='2' stroke-linecap='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 40, WebkitCalendarPickerIndicator: 'none' }}
                />
                <label style={{ fontSize: '.75rem', color: dark ? '#9ab8a9' : '#6a8b7c', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>To</label>
                <input
                  type="date" value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  style={{ padding: '9px 12px', border: dark ? '1.5px solid #2a5c3c' : '1.5px solid #e3ede8', borderRadius: 9, fontFamily: 'inherit', fontSize: '.82rem', color: dark ? '#eaf5f0' : '#0c1c14', outline: 'none', width: '100%', boxSizing: 'border-box', minHeight: 44, display: 'block', backgroundColor: dark ? '#0f2d1f' : '#fff', colorScheme: dark ? 'dark' : 'light', WebkitAppearance: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236a8b7c' stroke-width='2' stroke-linecap='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 40, WebkitCalendarPickerIndicator: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowCustomPop(false)} className="dfb-cancel-btn" style={{ flex: 1, padding: '9px', background: dark ? '#0a1f15' : '#f0f5f2', color: dark ? '#9ab8a9' : '#2a4e3c', border: 'none', borderRadius: 9, fontFamily: 'inherit', fontSize: '.8rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={applyCustom} className="dfb-apply-btn" style={{ flex: '1 1 0', padding: '10px', color: '#fff', border: 'none', borderRadius: 9, fontFamily: 'inherit', fontSize: '.8rem', fontWeight: 700, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', minHeight: 40 }}>Apply</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
