'use client';

import { useState, useEffect } from 'react';
import { CardColumn } from './CardColumn';

type WorkLogEntry = { timestamp: string; message: string };
type Attachment = { path: string; name: string };

export type Card = {
  id: string;
  title: string;
  state: 'backlog' | 'in-progress' | 'in-review' | 'shipped';
  priority: 'critical' | 'high' | 'normal' | 'low';
  attachments: Attachment[];
  workLog: WorkLogEntry[];
  createdAt: string;
  updatedAt: string;
};

const STATES = ['backlog', 'in-progress', 'in-review', 'shipped'] as const;

export function BoardClient({ initialCards }: { initialCards: Card[] }) {
  const [cards, setCards] = useState<Card[]>(initialCards);

  useEffect(() => {
    const es = new EventSource('/api/ws');
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'card_created') {
          setCards(prev => [...prev, event.card]);
        } else if (event.type === 'card_moved') {
          setCards(prev => prev.map(c => c.id === event.card.id ? event.card : c));
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-zinc-950">
      <header className="shrink-0 px-6 py-4 border-b border-white/5 bg-zinc-900/80 backdrop-blur-sm">
        <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">AM Board</h1>
      </header>
      <div className="flex-1 flex flex-row overflow-hidden">
        {STATES.map(state => (
          <CardColumn
            key={state}
            state={state}
            cards={cards.filter(c => c.state === state)}
          />
        ))}
      </div>
    </div>
  );
}
