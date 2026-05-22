import React, { createContext, useContext, useState } from 'react';
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

  function updateDashState(partial) {
    setDashState((prev) => ({ ...prev, ...partial }));
  }

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
