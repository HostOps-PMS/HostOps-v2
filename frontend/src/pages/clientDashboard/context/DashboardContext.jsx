import React, { createContext, useCallback, useContext, useState } from 'react';
import { getPresetRange } from '../../utils/dateHelpers';

const DashboardContext = createContext(null);

const defaultRange = getPresetRange('ytd');

export function DashboardProvider({ children }) {
  const [dashState, setDashState] = useState({
    from: defaultRange.from,
    to: defaultRange.to,
    preset: 'ytd',
    channels: [],
    view: 'multi',
    rawData: null,
    calBaseDate: null,
    calDaysCount: 90,
    calMonthsCount: 6,
  });

  // useCallback ensures this function reference is stable across renders,
  // preventing useDashboardData's useCallback from re-creating on every render
  // (which was causing loadData to fire repeatedly).
  const updateDashState = useCallback((partial) => {
    setDashState((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <DashboardContext.Provider value={{ dashState, setDashState, updateDashState }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside DashboardProvider');
  return ctx;
}