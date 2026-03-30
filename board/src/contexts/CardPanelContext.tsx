'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useBoardData } from './BoardDataContext';

export type CardType = 'task' | 'lead' | 'account' | 'candidate';

export type Card = {
  id: string;
  title: string;
  state: 'backlog' | 'in-progress' | 'in-review' | 'shipped';
  priority: 'critical' | 'high' | 'normal' | 'low';
  attachments: { path: string; name: string }[];
  workLog: { timestamp: string; message: string }[];
  tokenLogs: { iter: number; inputTokens: number; outputTokens: number; cacheRead: number; timestamp: string }[];
  workDir: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  inProgressAt?: string;
  inReviewAt?: string;
  shippedAt?: string;
  version?: string | null;
  commitSha?: string | null;
  cardType: CardType;
  entityFields: Record<string, string | number | null>;
  dependencies?: { id: string; title: string; state: string }[];
};

type CardPanelContextValue = {
  selectedCard: Card | null;
  openCard: (card: Card) => void;
  closeCard: () => void;
};

const CardPanelContext = createContext<CardPanelContextValue>({
  selectedCard: null,
  openCard: () => {},
  closeCard: () => {},
});

export function useCardPanel() {
  return useContext(CardPanelContext);
}

export function CardPanelProvider({ children }: { children: ReactNode }) {
  const { cards } = useBoardData();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Derive selectedCard from the live cards list — always up-to-date
  const selectedCard = selectedCardId ? (cards.find(c => c.id === selectedCardId) ?? null) : null;

  // Open card from ?card= URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cardId = params.get('card');
    if (cardId) setSelectedCardId(cardId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync ?card=<id> in URL when selected card changes
  useEffect(() => {
    const base = window.location.pathname;
    if (selectedCardId) {
      window.history.replaceState(null, '', `${base}?card=${selectedCardId}`);
    } else {
      window.history.replaceState(null, '', base);
    }
  }, [selectedCardId]);

  const openCard = useCallback((card: Card) => setSelectedCardId(card.id), []);
  const closeCard = useCallback(() => setSelectedCardId(null), []);

  return (
    <CardPanelContext.Provider value={{ selectedCard, openCard, closeCard }}>
      {children}
    </CardPanelContext.Provider>
  );
}
