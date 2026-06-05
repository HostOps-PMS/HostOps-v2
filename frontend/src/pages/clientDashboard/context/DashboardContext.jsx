import React, { createContext, useCallback, useContext, useState } from 'react';
import { getPresetRange } from '../../utils/dateHelpers';

const DashboardContext = createContext(null);

const defaultRange = getPresetRange('ytd');

// ── Persist property selection in localStorage ────────────────────────────────
// FIX: Dati ito ay nakalagay sa sessionStorage, na HINDI nananatili
// kapag nag-redirect mula sa ibang origin (core.hostops.online → go.hostops.online).
// Ang sessionStorage ay per-tab at per-origin — kapag nag-cross-origin redirect
// ang login app, blangko ang sessionStorage ng dashboard app, kaya lagi itong
// nagpapakita ng PropertySelectorModal at nagdudulot ng redirect loop.
// localStorage ay nananatili across origins (same browser), tabs, at page refreshes.
const PROP_ID_KEY   = 'hp_selected_property_id';
const PROP_NAME_KEY = 'hp_selected_property_name';

function readStoredProperty() {
  try {
    const id   = localStorage.getItem(PROP_ID_KEY)   || null;
    const name = localStorage.getItem(PROP_NAME_KEY) || '';
    return { id, name };
  } catch {
    return { id: null, name: '' };
  }
}

export function DashboardProvider({ children }) {
  const restoredProp = readStoredProperty();

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
    // When set, every /api/dashboard call includes ?propertyDbId=<id> so the
    // backend narrows bookings, inbox, and stats to that single property.
    //
    // showPropertySelector: true on first visit (no stored value) so the
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
        // FIX: localStorage instead of sessionStorage — persists across
        // cross-origin redirects (login app → dashboard app).
        localStorage.setItem(PROP_ID_KEY,   String(id));
        localStorage.setItem(PROP_NAME_KEY, name || '');
      } else {
        localStorage.removeItem(PROP_ID_KEY);
        localStorage.removeItem(PROP_NAME_KEY);
      }
    } catch {
      // localStorage write failed (private mode quota) — ignore, state still updates
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