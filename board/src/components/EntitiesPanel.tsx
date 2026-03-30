'use client';

import { Card } from './BoardClient';
import { useCardPanel } from '@/contexts/CardPanelContext';

const ENTITY_TYPES = ['lead', 'account', 'candidate'] as const;
type EntityType = typeof ENTITY_TYPES[number];

const ENTITY_COLORS: Record<EntityType, string> = {
  lead: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  account: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  candidate: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
};

export function EntitiesPanel({
  open,
  onClose,
  cards,
}: {
  open: boolean;
  onClose: () => void;
  cards: Card[];
}) {
  const { openCard } = useCardPanel();

  const entityCards = cards.filter(c => c.cardType && c.cardType !== 'task');

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="text-sm font-semibold text-zinc-200">Entities</span>
            <span className="text-xs text-zinc-500">({entityCards.length})</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {entityCards.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">No entity cards yet. Create one with <code className="text-xs bg-zinc-800 px-1 py-0.5 rounded">board create --type lead|account|candidate</code></p>
          ) : (
            <div className="flex flex-col gap-8">
              {ENTITY_TYPES.map(type => {
                const group = entityCards.filter(c => c.cardType === type);
                if (group.length === 0) return null;
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${ENTITY_COLORS[type]}`}>
                        {type}
                      </span>
                      <span className="text-xs text-zinc-600">({group.length})</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {group.map(card => (
                        <button
                          key={card.id}
                          type="button"
                          className="w-full text-left px-3 py-2.5 rounded-lg bg-zinc-800/60 border border-white/8 hover:bg-zinc-700/60 hover:border-white/15 transition-all"
                          onClick={() => { openCard(card); onClose(); }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-zinc-200 leading-snug">{card.title}</span>
                            <span className="text-xs text-zinc-500 font-mono shrink-0">{card.state}</span>
                          </div>
                          {Object.keys(card.entityFields ?? {}).length > 0 && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                              {Object.entries(card.entityFields ?? {}).slice(0, 4).map(([key, value]) => (
                                <span key={key} className="text-xs text-zinc-500">
                                  <span className="text-zinc-600">{key}:</span> {value === null ? <span className="italic">null</span> : String(value)}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
