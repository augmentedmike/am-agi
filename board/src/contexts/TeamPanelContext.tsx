'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type TeamPanelContextValue = {
  showTeam: boolean;
  openTeam: () => void;
  closeTeam: () => void;
};

const TeamPanelContext = createContext<TeamPanelContextValue>({
  showTeam: false,
  openTeam: () => {},
  closeTeam: () => {},
});

export function useTeamPanel() {
  return useContext(TeamPanelContext);
}

export function TeamPanelProvider({ children }: { children: ReactNode }) {
  const [showTeam, setShowTeam] = useState(false);
  const openTeam = useCallback(() => setShowTeam(true), []);
  const closeTeam = useCallback(() => setShowTeam(false), []);

  return (
    <TeamPanelContext.Provider value={{ showTeam, openTeam, closeTeam }}>
      {children}
    </TeamPanelContext.Provider>
  );
}
