import { useState, useCallback } from 'react';

/**
 * Manages the calendar's base date and viewport window.
 * Initialized to the first day of the current month.
 */
export function useCalendarNav() {
  const [calBaseDate, setCalBaseDate] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const [calMonthsCount, setCalMonthsCount] = useState(6);
  const [shouldScrollToToday, setShouldScrollToToday] = useState(true);

  const shiftCalendar = useCallback((deltaDays) => {
    setCalBaseDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + deltaDays);
      return d;
    });
  }, []);

  const goToToday = useCallback(() => {
    const t = new Date();
    setCalBaseDate(new Date(t.getFullYear(), t.getMonth(), 1));
    setShouldScrollToToday(true);
  }, []);

  const loadMoreMonths = useCallback(() => {
    setCalMonthsCount((prev) => prev + 2);
  }, []);

  const consumeScrollToToday = useCallback(() => {
    setShouldScrollToToday(false);
  }, []);

  return {
    calBaseDate,
    calMonthsCount,
    shouldScrollToToday,
    shiftCalendar,
    goToToday,
    loadMoreMonths,
    consumeScrollToToday,
  };
}
