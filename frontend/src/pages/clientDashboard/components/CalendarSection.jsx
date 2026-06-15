import React, { useState, useRef, useEffect } from 'react';
import CalendarGrid from './CalendarGrid';
import { useDashboard } from '../context/DashboardContext';
import { useCalendarNav } from '../hooks/useCalendarNav';
import { getPresetRange, fmtDateShort, ALL_PRESETS } from '../../utils/dateHelpers';
import { useDashboardData } from '../hooks/useDashboardData';
import { useActivityLog } from '../hooks/useActivityLog';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Complete calendar section: filter bar + nav bar + CalendarGrid.
 */
export default function CalendarSection() {
  const { dashState, updateDashState, dark } = useDashboard();
  const { loadData } = useDashboardData();
  const {
    calBaseDate, calMonthsCount, shouldScrollToToday,
    shiftCalendar, goToToday, loadMoreMonths, consumeScrollToToday,
  } = useCalendarNav();

  const [showDatePop, setShowDatePop] = useState(false);
  const [showFilterPop, setShowFilterPop] = useState(false);
  const [showPropDrop, setShowPropDrop] = useState(false);
  const [localFrom, setLocalFrom] = useState(dashState.from || '');
  const [localTo, setLocalTo] = useState(dashState.to || '');
  const [selectedPreset, setSelectedPreset] = useState(dashState.preset || 'monthly');
  const [tempChannels, setTempChannels] = useState([...dashState.channels]);
  const { logActivity } = useActivityLog();

  const datePopRef = useRef(null);
  const filterPopRef = useRef(null);
  const propDropRef = useRef(null);

  // Close popovers on outside click
  useEffect(() => {
    function handler(e) {
      if (datePopRef.current && !datePopRef.current.contains(e.target)) setShowDatePop(false);
      if (filterPopRef.current && !filterPopRef.current.contains(e.target)) setShowFilterPop(false);
      if (propDropRef.current && !propDropRef.current.contains(e.target)) setShowPropDrop(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navLabel = `${MONTHS[calBaseDate.getMonth()]} ${calBaseDate.getFullYear()}`;

  const data = dashState.rawData || {};
  const properties = data.properties || [];
  const bookings = data.bookings || [];

  const availableChannels = data.byChannel ? Object.keys(data.byChannel) : ['Airbnb', 'Booking.com', 'VRBO', 'Agoda', 'Direct'];

  function applyPreset(preset) {
    const range = getPresetRange(preset);
    updateDashState({ preset, from: range.from, to: range.to });
    setSelectedPreset(preset);
    setShowDatePop(false);
    // Pass dates explicitly — avoids reading a stale useCallback closure
    loadData(range.from, range.to);
    logActivity('changed_date_filter', { preset });
  }

  function applyCustomRange() {
    if (!localFrom || !localTo) { alert('Please select both dates'); return; }
    if (localFrom > localTo) { alert('"From" must be before "To"'); return; }
    updateDashState({ preset: 'custom', from: localFrom, to: localTo });
    setSelectedPreset('custom');
    setShowDatePop(false);
    // Pass dates explicitly — avoids reading a stale useCallback closure
    loadData(localFrom, localTo);
  }

  function applyChannelFilter() {
    updateDashState({ channels: tempChannels });
    setShowFilterPop(false);
    logActivity('filtered_by_channel', { channels: tempChannels });
  }

  function clearChannelFilter() {
    setTempChannels([]);
    updateDashState({ channels: [] });
    setShowFilterPop(false);
  }

  function toggleChannel(ch) {
    setTempChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  }

  const dateLabel = selectedPreset !== 'custom'
    ? ALL_PRESETS.find((p) => p.id === selectedPreset)?.label || 'Monthly'
    : `${fmtDateShort(localFrom)} – ${fmtDateShort(localTo)}`;

  const filterLabel = dashState.channels.length > 0
    ? dashState.channels.join(', ')
    : 'All channels';

  return (
    <div className="db-card" style={{ padding: 0, marginBottom: 20, overflow: 'visible', background: dark ? '#132a1e' : '#fff', border: dark ? '1px solid #1e3a2a' : undefined, transition: 'background 0.2s' }}>
      <style>{`
        .cal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 14px; }
        .cal-title { font-family: 'Sora', sans-serif; font-size: 1rem; font-weight: 800; color: ${dark ? '#eaf5f0' : '#0c1c14'}; }
        .cal-controls { display: flex; gap: 8px; align-items: center; }
        .cal-btn { background: ${dark ? '#1a3d28' : '#f0f5f2'}; border: 1px solid ${dark ? '#2a5c3c' : '#e3ede8'}; padding: 6px 12px; border-radius: 100px; font-size: .75rem; font-weight: 600; color: ${dark ? '#a8d4bc' : '#0c1c14'}; cursor: pointer; display: flex; align-items: center; gap: 5px; white-space: nowrap; }
        .cal-btn-group { background: ${dark ? '#0a1f15' : '#f0f5f2'}; border-radius: 100px; padding: 3px; display: flex; }
        .cal-btn-group button { background: transparent; border: none; padding: 5px 12px; border-radius: 100px; font-size: .75rem; font-weight: 700; color: ${dark ? '#7aab8a' : '#6a8b7c'}; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .cal-btn-group button.active { background: #26a676; color: #fff; }
        .cal-nav { display: flex; flex-direction: row; align-items: center; gap: 10px; padding: 14px 24px; border-bottom: 1px solid ${dark ? '#1e3a2a' : '#f0f5f2'}; background: ${dark ? '#0d2619' : '#f7faf8'}; flex-wrap: nowrap; white-space: nowrap; overflow: hidden; }
        .cal-nav > * { flex-shrink: 0; }
        .cal-nav-btn { width: 30px; height: 30px; border: 1px solid ${dark ? '#2a5c3c' : '#e3ede8'}; border-radius: 50%; background: ${dark ? '#0d2619' : '#f0f5f2'}; color: ${dark ? '#9ab8a9' : '#6a8b7c'}; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .15s; }
        .cal-nav-btn:hover { background: ${dark ? '#1a3d28' : '#eaf8f1'}; color: ${dark ? '#56c299' : '#1e8760'}; border-color: ${dark ? '#2a5c3c' : '#b7e4cf'}; }
        .cal-nav-label { font-family: 'Sora', sans-serif; font-size: 1rem; font-weight: 800; color: ${dark ? '#eaf5f0' : '#0c1c14'}; padding: 0 6px; flex: 1; }
        .cal-nav-today { padding: 6px 14px; border: 1px solid ${dark ? '#2a5c3c' : '#b7e4cf'}; background: ${dark ? '#1a3d28' : '#eaf8f1'}; color: ${dark ? '#56c299' : '#1e8760'}; border-radius: 100px; font-family: 'DM Sans', sans-serif; font-size: .75rem; font-weight: 700; cursor: pointer; margin-left: auto; }
        .cal-nav-today:hover { background: ${dark ? '#163d28' : '#d4f0e4'}; }

        @media (max-width: 768px) {
          .cal-header-responsive { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; padding: 14px 16px 12px !important; }
          .cal-controls-responsive { width: 100% !important; flex-wrap: wrap !important; gap: 6px !important; }
          .cal-controls-responsive .cal-btn { font-size: .7rem !important; padding: 5px 10px !important; }
          .cal-controls-responsive .cal-btn-group button { font-size: .7rem !important; padding: 4px 10px !important; }
          .cal-nav { padding: 10px 16px !important; }
          .cal-nav-label { font-size: .88rem !important; }
        }

        @media (max-width: 480px) {
          .cal-controls-responsive { gap: 5px !important; }
          .cal-controls-responsive .cal-btn { font-size: .68rem !important; padding: 5px 8px !important; }
        }
      `}</style>
      {/* Toolbar */}
      <div className="cal-header cal-header-responsive" style={{ borderBottom: dark ? '1px solid #1e3a2a' : '1px solid #f0f5f2' }}>
        <div className="cal-title" style={{ color: dark ? '#eaf5f0' : '#0c1c14' }}>Availability Calendar</div>
        <div className="cal-controls cal-controls-responsive" style={{ position: 'relative' }}>
          {/* Date range button */}
          <div style={{ position: 'relative' }} ref={datePopRef}>
           <button className="cal-btn" style={{ background: dark ? '#1a3d28' : '#fff', borderColor: dark ? '#2a5c3c' : '#e3ede8', color: dark ? '#a8d4bc' : '#0c1c14' }} onClick={() => { setShowDatePop((v) => !v); setShowFilterPop(false); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {dateLabel}
            </button>

            {showDatePop && (
              <div className={`hp-popover${dark ? ' hp-popover-dark' : ''}`} style={{ top: '100%', left: 0, marginTop: 6, background: dark ? '#132a1e' : '#fff', border: dark ? '1px solid #1e3a2a' : '1px solid #e3ede8' }}>
                {dark && <style>{`.hp-popover-dark .hp-preset { color: #c8e6d6; } .hp-popover-dark .hp-preset:hover { background: #1a3d28 !important; } .hp-popover-dark .hp-preset.active { background: #1e3a2a !important; color: #56c299 !important; }`}</style>}
                <div style={{ fontSize: '.7rem', fontWeight: 700, color: dark ? '#6aab8a' : '#9ab8a9', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 8, padding: '0 6px' }}>Quick ranges</div>
                {ALL_PRESETS.map((p) => (
                  <button key={p.id} className={`hp-preset${selectedPreset === p.id ? ' active' : ''}`} onClick={() => applyPreset(p.id)}>
                    {p.label}
                  </button>
                ))}
                <div style={{ borderTop: dark ? '1px solid #1a3d28' : '1px solid #f0f5f2', marginTop: 10, paddingTop: 10 }}>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, color: dark ? '#6aab8a' : '#9ab8a9', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 8, padding: '0 6px' }}>Custom range</div>
                  <div style={{ display: 'flex', gap: 8, padding: '0 6px', marginBottom: 8 }}>
                    <input type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} style={{ flex: 1, padding: '8px', border: dark ? '1.5px solid #2a5c3c' : '1.5px solid #e3ede8', borderRadius: 8, fontFamily: 'inherit', fontSize: '.8rem', background: dark ? '#0f2d1f' : '#fff', color: dark ? '#eaf5f0' : '#0c1c14', colorScheme: dark ? 'dark' : 'light' }} />
                    <input type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)} style={{ flex: 1, padding: '8px', border: dark ? '1.5px solid #2a5c3c' : '1.5px solid #e3ede8', borderRadius: 8, fontFamily: 'inherit', fontSize: '.8rem', background: dark ? '#0f2d1f' : '#fff', color: dark ? '#eaf5f0' : '#0c1c14', colorScheme: dark ? 'dark' : 'light' }} />
                  </div>
                  <button onClick={applyCustomRange} style={{ width: 'calc(100% - 12px)', margin: '0 6px', padding: '9px', background: '#26a676', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: '.82rem', fontWeight: 700, cursor: 'pointer' }}>
                    Apply custom range
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Channel filter button */}
          <div style={{ position: 'relative' }} ref={filterPopRef}>
            <button className="cal-btn" style={{ background: dark ? '#1a3d28' : '#fff', borderColor: dark ? '#2a5c3c' : '#e3ede8', color: dark ? '#a8d4bc' : '#0c1c14' }} onClick={() => { setShowFilterPop((v) => !v); setShowDatePop(false); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {filterLabel}
            </button>

            {showFilterPop && (
              <div className="hp-popover" style={{ top: '100%', left: 0, marginTop: 6, minWidth: 220, background: dark ? '#132a1e' : '#fff', border: dark ? '1px solid #1e3a2a' : '1px solid #e3ede8' }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, color: dark ? '#6aab8a' : '#9ab8a9', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 8, padding: '0 6px' }}>Filter by channel</div>
                {availableChannels.map((ch) => (
                  <label key={ch} onMouseEnter={e => { e.currentTarget.style.background = dark ? '#1a3d28' : '#edf7f1'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', cursor: 'pointer', borderRadius: 8, fontSize: '.85rem', color: dark ? '#c8e6d6' : '#0c1c14', fontWeight: 600, transition: 'background .1s' }}>
                    <input type="checkbox" checked={tempChannels.includes(ch)} onChange={() => toggleChannel(ch)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#26a676' }} />
                    {ch}
                  </label>
                ))}
                <div style={{ borderTop: dark ? '1px solid #1a3d28' : '1px solid #f0f5f2', marginTop: 8, paddingTop: 8, display: 'flex', gap: 6 }}>
                  <button onClick={clearChannelFilter} style={{ flex: 1, padding: 8, background: dark ? '#0a1f15' : '#f0f5f2', color: dark ? '#9ab8a9' : '#2a4e3c', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: '.8rem', fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                  <button onClick={applyChannelFilter} style={{ flex: 1, padding: 8, background: '#26a676', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: '.8rem', fontWeight: 700, cursor: 'pointer' }}>Apply</button>
                </div>
              </div>
            )}
          </div>

          {/* Property selector — single view only */}
          {dashState.view === 'single' && (
            <div style={{ position: 'relative' }} ref={propDropRef}>
              <button
                className="cal-btn"
                style={{ background: dark ? '#1a3d28' : '#f0f5f2', borderColor: dark ? '#2a5c3c' : '#e3ede8', color: dark ? '#a8d4bc' : '#0c1c14', maxWidth: 160, justifyContent: 'space-between', gap: 6 }}
                onClick={() => setShowPropDrop(v => !v)}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {properties.find(p => p.id === dashState.singlePropId)?.name || 'Select property'}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, transform: showPropDrop ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showPropDrop && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 190, background: dark ? '#132a1e' : '#fff', border: dark ? '1px solid #1e3a2a' : '1px solid #e3ede8', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.22)', zIndex: 999, overflow: 'hidden', padding: '4px 0' }}>
                  {properties.map(p => {
                    const isActive = dashState.singlePropId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => { updateDashState({ singlePropId: p.id }); setShowPropDrop(false); }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = dark ? '#1a3d28' : '#edf7f1'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isActive ? (dark ? '#1a3d28' : '#eaf8f1') : 'transparent'; }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '.8rem', fontWeight: isActive ? 700 : 500, background: isActive ? (dark ? '#1a3d28' : '#eaf8f1') : 'transparent', color: isActive ? (dark ? '#56c299' : '#1a6b44') : (dark ? '#c8e6d6' : '#2a4e3c'), border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'background .1s' }}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="cal-btn-group" style={{ background: dark ? '#0a1f15' : '#f0f5f2' }}>
            {['multi', 'single'].map((v) => (
              <button
                key={v}
                className={dashState.view === v ? 'active' : ''}
                onClick={() => { updateDashState({ view: v }); logActivity('switched_calendar_view', { view: v }); }}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar nav bar — hidden in single view */}
      {dashState.view !== 'single' && <div className="cal-nav" style={{ background: dark ? '#0f2d1f' : '#fff', borderBottom: dark ? '1px solid #1e3a2a' : '1px solid #f0f5f2', overflowX: 'auto', overflowY: 'visible' }}>
        <button className="cal-nav-btn" onClick={() => shiftCalendar(-30)} title="Previous month">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <button className="cal-nav-btn" onClick={() => shiftCalendar(30)} title="Next month">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
        <span className="cal-nav-label" style={{ color: dark ? '#eaf5f0' : '#0c1c14' }}>{navLabel}</span>
        <button className="cal-nav-today" onClick={goToToday}>Today</button>
      </div>}

      <CalendarGrid
        properties={properties}
        bookings={bookings}
        calBaseDate={calBaseDate}
        calMonthsCount={calMonthsCount}
        view={dashState.view}
        channels={dashState.channels}
        singlePropId={dashState.singlePropId}
        shouldScrollToToday={shouldScrollToToday}
        onScrollToTodayConsumed={consumeScrollToToday}
        onLoadMore={loadMoreMonths}
      />
    </div>
  );
}
