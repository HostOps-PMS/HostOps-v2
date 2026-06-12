import React, { createContext, useCallback, useContext, useState } from 'react';
import { getPresetRange } from '../../utils/dateHelpers';
import safeStorage from '../../safeStorage';

// ── Why safeStorage? ──────────────────────────────────────────────────────────
// On go.hostops.online, accessing localStorage throws a SecurityError before
// any read/write can happen. readStoredProperty() was throwing silently,
// returning { id: null, name: '' } every time, which forced showPropertySelector
// to true on every mount — causing the infinite reload/redirect loop.
// safeStorage catches the failure at module-load time and falls back to an
// in-memory Map, so reads/writes never throw and the app functions correctly.
// ─────────────────────────────────────────────────────────────────────────────

const DashboardContext = createContext(null);

const defaultRange = getPresetRange('monthly');

const PROP_ID_KEY   = 'hp_selected_property_id';
const PROP_NAME_KEY = 'hp_selected_property_name';

function readStoredProperty() {
  // safeStorage.getItem never throws — fallback is handled internally.
  const id   = safeStorage.getItem(PROP_ID_KEY)   || null;
  const name = safeStorage.getItem(PROP_NAME_KEY) || '';
  return { id, name };
}

export function DashboardProvider({ children }) {
  const restoredProp = readStoredProperty();

  const [dashState, setDashState] = useState({
    from: defaultRange.from,
    to: defaultRange.to,
    preset: 'monthly',
    channels: [],
    view: 'multi',
    rawData: null,
    calBaseDate: null,
    calDaysCount: 90,
    calMonthsCount: 6,

    selectedPropertyId:   restoredProp.id,
    selectedPropertyName: restoredProp.name,
    // Only show selector if no property was previously saved.
    // With safeStorage this now works correctly even when localStorage
    // is blocked — the in-memory store is read consistently.
    showPropertySelector: !restoredProp.id,
    isSwitching: false,
  });

  const [dark, setDark] = useState(false);

  const updateDashState = useCallback((partial) => {
    setDashState((prev) => ({ ...prev, ...partial }));
  }, []);

  const selectProperty = useCallback((id, name) => {
    // safeStorage.setItem/removeItem never throw.
    if (id) {
      safeStorage.setItem(PROP_ID_KEY,   String(id));
      safeStorage.setItem(PROP_NAME_KEY, name || '');
    } else {
      safeStorage.removeItem(PROP_ID_KEY);
      safeStorage.removeItem(PROP_NAME_KEY);
    }

    setDashState((prev) => ({
      ...prev,
      selectedPropertyId:   id   || null,
      selectedPropertyName: name || '',
      showPropertySelector: false,
      rawData:      null,
      isSwitching:  true,
    }));
  }, []);

  const openPropertySelector = useCallback(() => {
    setDashState((prev) => ({ ...prev, showPropertySelector: true }));
  }, []);

  return (
    <DashboardContext.Provider value={{
      dashState,
      setDashState,
      updateDashState,
      dark,
      setDark,
      selectProperty,
      openPropertySelector,
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside DashboardProvider');
  return ctx;
}
