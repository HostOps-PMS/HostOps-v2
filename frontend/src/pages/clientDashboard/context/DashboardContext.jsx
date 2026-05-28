import React, { createContext, useCallback, useContext, useState } from 'react';
import { getPresetRange } from '../../utils/dateHelpers';

const DashboardContext = createContext(null);

const defaultRange = getPresetRange('ytd');

// ── Restore property selection from sessionStorage ────────────────────────────
// Persisted so that page refreshes within the same session keep the selection.
// Cleared automatically when the browser session ends (tab close / logout).
const SESSION_PROP_ID_KEY   = 'hp_selected_property_id';
const SESSION_PROP_NAME_KEY = 'hp_selected_property_name';

function readSessionProperty() {
  try {
    const id   = sessionStorage.getItem(SESSION_PROP_ID_KEY)   || null;
    const name = sessionStorage.getItem(SESSION_PROP_NAME_KEY) || '';
    return { id, name };
  } catch {
    return { id: null, name: '' };
  }
}

export function DashboardProvider({ children }) {
  const restoredProp = readSessionProperty();

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

    // ── Property selection ────────────────────────────────────────────────────
    // selectedPropertyId: null means "All Properties" (no per-property filter).
    // When set, every /api/dashboard call includes ?apartmentId=<id> so the
    // backend narrows bookings, inbox, and stats to that single property.
    //
    // showPropertySelector: true on first visit (no session value) so the
    // PropertySelectorModal is displayed before any data loads.
    // Set to false after the user confirms their selection.
    selectedPropertyId:   restoredProp.id,
    selectedPropertyName: restoredProp.name,
    showPropertySelector: !restoredProp.id,
  });

  const [dark, setDark] = useState(false);

  const updateDashState = useCallback((partial) => {
    setDashState((prev) => ({ ...prev, ...partial }));
  }, []);

  // ── selectProperty ───────────────────────────────────────────────────────────
  // Called by PropertySelectorModal when the user confirms a choice.
  // id === null means "All Properties".
  const selectProperty = useCallback((id, name) => {
    try {
      if (id) {
        sessionStorage.setItem(SESSION_PROP_ID_KEY,   String(id));
        sessionStorage.setItem(SESSION_PROP_NAME_KEY, name || '');
      } else {
        sessionStorage.removeItem(SESSION_PROP_ID_KEY);
        sessionStorage.removeItem(SESSION_PROP_NAME_KEY);
      }
    } catch {
      // sessionStorage unavailable (private mode quota) — ignore, state still updates
    }

    setDashState((prev) => ({
      ...prev,
      selectedPropertyId:   id   || null,
      selectedPropertyName: name || '',
      showPropertySelector: false,
    }));
  }, []);

  // ── openPropertySelector ─────────────────────────────────────────────────────
  // Programmatically re-open the modal (e.g. from the "Change Property" button).
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