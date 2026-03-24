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
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-6">AM Kanban Board</h1>
      <div className="grid grid-cols-4 gap-4">
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
