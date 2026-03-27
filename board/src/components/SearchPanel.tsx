'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from './BoardClient';
import { useLocale } from '@/contexts/LocaleContext';

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  normal: 'text-zinc-400',
  low: 'text-zinc-500',
};

const STATE_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  shipped: 'Shipped',
};

export function SearchPanel({
  open,
  onClose,
  cards,
  onCardClick,
}: {
  open: boolean;
  onClose: () => void;
  cards: Card[];
  onCardClick: (card: Card) => void;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = query.trim()
    ? cards.filter(c => c.title.toLowerCase().includes(query.toLowerCase()))
    : cards;

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-panel-title"
        className={`absolute inset-y-0 right-0 w-full sm:max-w-xl bg-zinc-900/95 backdrop-blur-md border-l border-white/10 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <span id="search-panel-title" className="text-sm font-semibold uppercase tracking-wide text-zinc-400">{t('search')}</span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none"
            aria-label={t('closePanel')}
          >
            ✕
          </button>
        </div>

        {/* Search input */}
        <div className="px-6 py-4 border-b border-white/10 shrink-0">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('searchCards')}
              className="w-full bg-zinc-800/70 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        </div>

        {/* Results */}
        <div aria-live="polite" aria-atomic="true" className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">
              {query.trim() ? 'No cards match your search.' : 'No cards.'}
            </p>
          ) : (
            filtered.map(card => (
              <button
                key={card.id}
                onClick={() => { onClose(); onCardClick(card); }}
                className="w-full text-left px-4 py-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/60 border border-white/5 hover:border-white/10 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm text-zinc-100 font-medium leading-snug line-clamp-2 group-hover:text-white">
                    {card.title}
                  </span>
                  <span className={`text-xs shrink-0 mt-0.5 font-semibold uppercase ${PRIORITY_COLORS[card.priority] ?? 'text-zinc-400'}`}>
                    {card.priority}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{STATE_LABELS[card.state] ?? card.state}</span>
                  <span className="text-xs text-zinc-600">·</span>
                  <span className="text-xs text-zinc-600 font-mono">{card.id}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-white/10 shrink-0">
            <p className="text-xs text-zinc-500">
              {filtered.length} {filtered.length === 1 ? 'card' : 'cards'}{query.trim() ? ' found' : ' total'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
