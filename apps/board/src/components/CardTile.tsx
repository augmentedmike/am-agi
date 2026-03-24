import Link from 'next/link';
import { Card } from './BoardClient';

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border border-red-500/30',
  high: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  normal: 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30',
  low: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
};

export function CardTile({ card }: { card: Card }) {
  const lastLog = card.workLog[card.workLog.length - 1];
  return (
    <Link href={`/cards/${card.id}`}>
      <div className="bg-zinc-800/60 backdrop-blur-sm border border-white/10 rounded-xl p-3 hover:bg-zinc-700/70 hover:border-white/20 transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-sm font-medium text-zinc-100">{card.title}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${PRIORITY_BADGE[card.priority]}`}>
            {card.priority}
          </span>
        </div>
        {lastLog && (
          <p className="text-xs text-zinc-400 truncate">{lastLog.message}</p>
        )}
      </div>
    </Link>
  );
}
