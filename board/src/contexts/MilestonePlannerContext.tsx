'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type MilestonePlannerContextValue = {
  showMilestonePlanner: boolean;
  openMilestonePlanner: () => void;
  closeMilestonePlanner: () => void;
};

const MilestonePlannerContext = createContext<MilestonePlannerContextValue>({
  showMilestonePlanner: false,
  openMilestonePlanner: () => {},
  closeMilestonePlanner: () => {},
});

export function useMilestonePlanner() {
  return useContext(MilestonePlannerContext);
}

export function MilestonePlannerProvider({ children }: { children: ReactNode }) {
  const [showMilestonePlanner, setShowMilestonePlanner] = useState(false);
  const openMilestonePlanner = useCallback(() => setShowMilestonePlanner(true), []);
  const closeMilestonePlanner = useCallback(() => setShowMilestonePlanner(false), []);

  return (
    <MilestonePlannerContext.Provider value={{ showMilestonePlanner, openMilestonePlanner, closeMilestonePlanner }}>
      {children}
    </MilestonePlannerContext.Provider>
  );
}
