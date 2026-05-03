'use client';

import { STATE_TOKENS, PRIORITY_TOKENS } from '@/lib/tokens';
import { truncateTitle } from '@/lib/utils';

type Card = {
  id: string;
  title: string;
  state: string;
  priority: string;
  workDir?: string | null;
};

const STATES = ['backlog', 'in-progress', 'in-review', 'shipped'] as const;

const COLUMN_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  shipped: 'Shipped',
};

const PRIORITY_RANK: Record<string, number> = {
  AI: 0,
  critical: 1,
  high: 2,
  normal: 3,
  low: 4,
};

function sortCards(a: Card, b: Card): number {
  const aActive = !!a.workDir;
  const bActive = !!b.workDir;
  if (aActive !== bActive) return aActive ? -1 : 1;
  return (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
}

function EmbedCard({ card }: { card: Card }) {
  const isActive = !!card.workDir && card.state !== 'shipped';
  const priorityColors = PRIORITY_TOKENS[card.priority];

  return (
    <div className="bg-zinc-800/60 border border-white/10 rounded-lg px-3 py-2.5 flex items-start gap-2">
      {isActive && (
        <span className="relative flex h-2 w-2 mt-1 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 leading-snug truncate">{truncateTitle(card.title)}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {priorityColors && (
            <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${priorityColors.badge}`}>
              {card.priority}
            </span>
          )}
          <span className="text-[10px] text-zinc-500 font-mono">{card.state}</span>
        </div>
      </div>
    </div>
  );
}

function EmbedColumn({ state, cards }: { state: string; cards: Card[] }) {
  const colors = STATE_TOKENS[state] ?? STATE_TOKENS['backlog'];
  const sorted =
    state === 'shipped'
      ? [...cards].sort((a, b) => a.title.localeCompare(b.title))
      : [...cards].sort(sortCards);

  return (
    <div className="flex-1 flex flex-col h-full border-r border-white/5 last:border-r-0 min-w-0">
      <div className={`sticky top-0 z-10 bg-zinc-900/90 backdrop-blur-sm border-b border-white/5 px-3 py-2.5 ${colors.border}`}>
        <div className="flex items-center gap-2">
          <h2 className={`font-semibold text-xs uppercase tracking-wide ${colors.text}`}>
            {COLUMN_LABELS[state] ?? state}
          </h2>
          <span className="text-xs text-zinc-500 font-semibold">{cards.length}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-2">
        {sorted.map(card => (
          <EmbedCard key={card.id} card={card} />
        ))}
        {cards.length === 0 && (
          <p className="text-xs text-zinc-600 px-1 py-1">—</p>
        )}
      </div>
    </div>
  );
}

export function EmbedBoard({ cards, title }: { cards: Card[]; title?: string }) {
  const byState: Record<string, Card[]> = {};
  for (const s of STATES) byState[s] = [];
  for (const c of cards) {
    if (byState[c.state]) byState[c.state].push(c);
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-900 text-zinc-200 font-sans">
      {title && (
        <header className="shrink-0 px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-300">{title}</span>
          <span className="text-xs text-zinc-600">· AM</span>
        </header>
      )}
      <div className="flex flex-1 overflow-hidden">
        {STATES.map(s => (
          <EmbedColumn key={s} state={s} cards={byState[s]} />
        ))}
      </div>
    </div>
  );
}
