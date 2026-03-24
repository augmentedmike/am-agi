import Link from 'next/link';
import { Card } from './BoardClient';

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  normal: 'bg-gray-500 text-white',
  low: 'bg-blue-600 text-white',
};

export function CardTile({ card }: { card: Card }) {
  const lastLog = card.workLog[card.workLog.length - 1];
  return (
    <Link href={`/cards/${card.id}`}>
      <div className="bg-gray-800 rounded p-3 hover:bg-gray-700 transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-sm font-medium">{card.title}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${PRIORITY_BADGE[card.priority]}`}>
            {card.priority}
          </span>
        </div>
        {lastLog && (
          <p className="text-xs text-gray-400 truncate">{lastLog.message}</p>
        )}
      </div>
    </Link>
  );
}
