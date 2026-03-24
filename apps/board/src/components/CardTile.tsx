import { Card } from './BoardClient';

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border border-red-500/30',
  high: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  normal: 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30',
  low: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
};

export function CardTile({ card, onCardClick }: { card: Card; onCardClick: (card: Card) => void }) {
  const isActive = !!card.workDir;
  return (
    <div
      onClick={() => onCardClick(card)}
      className="bg-zinc-800/60 backdrop-blur-sm border border-white/10 rounded-xl p-3 hover:bg-zinc-700/70 hover:border-white/20 hover:-translate-y-0.5 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {isActive && (
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          )}
          <span className="text-base font-semibold text-zinc-100 leading-snug">{card.title}</span>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${PRIORITY_BADGE[card.priority]}`}>
          {card.priority}
        </span>
      </div>
      <p className="text-xs text-zinc-500 font-mono truncate mt-1">{card.id}</p>
    </div>
  );
}
