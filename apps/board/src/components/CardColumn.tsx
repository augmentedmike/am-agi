import { Card } from './BoardClient';
import { CardTile } from './CardTile';

const COLUMN_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  shipped: 'Shipped',
};

export function CardColumn({ state, cards }: { state: string; cards: Card[] }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 min-h-64">
      <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400 mb-3">
        {COLUMN_LABELS[state] ?? state} ({cards.length})
      </h2>
      <div className="space-y-2">
        {cards.map(card => (
          <CardTile key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
