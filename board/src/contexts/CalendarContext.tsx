'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type CalendarContextValue = {
  showCalendar: boolean;
  openCalendar: () => void;
  closeCalendar: () => void;
};

const CalendarContext = createContext<CalendarContextValue>({
  showCalendar: false,
  openCalendar: () => {},
  closeCalendar: () => {},
});

export function useCalendar() {
  return useContext(CalendarContext);
}

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const openCalendar = useCallback(() => setShowCalendar(true), []);
  const closeCalendar = useCallback(() => setShowCalendar(false), []);

  return (
    <CalendarContext.Provider value={{ showCalendar, openCalendar, closeCalendar }}>
      {children}
    </CalendarContext.Provider>
  );
}
