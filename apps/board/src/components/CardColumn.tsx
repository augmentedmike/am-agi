'use client';

import { useState, useEffect } from 'react';
import { Card } from './BoardClient';
import { CardTile } from './CardTile';

const COLUMN_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  shipped: 'Shipped',
};

function ShippedColumn({ cards, onCardClick }: { cards: Card[]; onCardClick: (card: Card) => void }) {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('board:shipped-collapsed');
    if (stored !== null) setCollapsed(stored === 'true');
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('board:shipped-collapsed', String(next));
  }

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center justify-start h-full border-r border-white/5 cursor-pointer hover:bg-zinc-800/30 transition-colors w-12 shrink-0 pt-4 gap-3"
        onClick={toggle}
        title="Expand shipped column"
      >
        <span className="text-pink-500 text-lg leading-none">›</span>
        <span
          className="text-xs font-semibold uppercase tracking-widest text-zinc-400 select-none [writing-mode:vertical-rl] rotate-180"
        >
          Shipped ({cards.length})
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col border-r border-white/5 min-w-0">
      <div className="sticky top-0 z-10 bg-zinc-900/80 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-400">
          Shipped ({cards.length})
        </h2>
        <button
          onClick={toggle}
          className="text-zinc-500 hover:text-pink-500 transition-colors text-lg leading-none"
          title="Collapse shipped column"
        >
          ‹
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {cards.map(card => (
          <CardTile key={card.id} card={card} onCardClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}

export function CardColumn({ state, cards, onCardClick }: { state: string; cards: Card[]; onCardClick: (card: Card) => void }) {
  if (state === 'shipped') {
    return <ShippedColumn cards={cards} onCardClick={onCardClick} />;
  }

  return (
    <div className="flex-1 h-full flex flex-col border-r border-white/5 min-w-0">
      <div className="sticky top-0 z-10 bg-zinc-900/80 backdrop-blur-sm border-b border-white/5 px-4 py-3">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-400">
          {COLUMN_LABELS[state] ?? state} ({cards.length})
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {cards.map(card => (
          <CardTile key={card.id} card={card} onCardClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}
