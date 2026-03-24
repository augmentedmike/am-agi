'use client';

import { useState, useEffect, useCallback } from 'react';
import { CardColumn } from './CardColumn';
import { CardPanel } from './CardPanel';

type WorkLogEntry = { timestamp: string; message: string };
type Attachment = { path: string; name: string };

export type Card = {
  id: string;
  title: string;
  state: 'backlog' | 'in-progress' | 'in-review' | 'shipped';
  priority: 'critical' | 'high' | 'normal' | 'low';
  attachments: Attachment[];
  workLog: WorkLogEntry[];
  workDir: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATES = ['backlog', 'in-progress', 'in-review', 'shipped'] as const;

export function BoardClient({ initialCards }: { initialCards: Card[] }) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/ws');
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'card_created') {
          setCards(prev => [...prev, event.card]);
        } else if (event.type === 'card_moved') {
          setCards(prev => prev.map(c => c.id === event.card.id ? event.card : c));
          // Update selected card if it moved
          setSelectedCard(prev => prev?.id === event.card.id ? event.card : prev);
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  const handleCardClick = useCallback((card: Card) => {
    setSelectedCard(card);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedCard(null);
  }, []);

  const activeCount = cards.filter(c => !!c.workDir).length;

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-zinc-950">
      <header className="shrink-0 px-6 py-4 border-b border-white/5 bg-zinc-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">AM Board</h1>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
            <span className="text-sm text-zinc-400">
              {activeCount} active
            </span>
          </div>
        </div>
      </header>
      <div className="flex-1 flex flex-row overflow-hidden">
        {STATES.map(state => (
          <CardColumn
            key={state}
            state={state}
            cards={cards.filter(c => c.state === state)}
            onCardClick={handleCardClick}
          />
        ))}
      </div>
      <CardPanel card={selectedCard} onClose={handleClosePanel} />
    </div>
  );
}
