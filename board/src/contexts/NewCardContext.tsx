'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type NewCardContextValue = {
  showNewForm: boolean;
  openNewCard: () => void;
  closeNewCard: () => void;
};

const NewCardContext = createContext<NewCardContextValue>({
  showNewForm: false,
  openNewCard: () => {},
  closeNewCard: () => {},
});

export function useNewCard() {
  return useContext(NewCardContext);
}

export function NewCardProvider({ children }: { children: ReactNode }) {
  const [showNewForm, setShowNewForm] = useState(false);
  const openNewCard = useCallback(() => setShowNewForm(true), []);
  const closeNewCard = useCallback(() => setShowNewForm(false), []);

  return (
    <NewCardContext.Provider value={{ showNewForm, openNewCard, closeNewCard }}>
      {children}
    </NewCardContext.Provider>
  );
}
