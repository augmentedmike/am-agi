'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

interface StMemory { slug: string; content: string; }
interface LtMemory { id: string; topic: string | null; content: string; created_at: string; }

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
  const [stMemories, setStMemories] = useState<StMemory[]>([]);
  const [ltMemories, setLtMemories] = useState<LtMemory[]>([]);
  const [memLoading, setMemLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setStMemories([]);
      setLtMemories([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const fetchMemories = useCallback(async (q: string) => {
    setMemLoading(true);
    try {
      const url = q.trim()
        ? `/api/memory?q=${encodeURIComponent(q)}&limit=20`
        : `/api/memory?list=1`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json() as { st: StMemory[]; lt: LtMemory[] };
      setStMemories(data.st ?? []);
      setLtMemories(data.lt ?? []);
    } catch {
      // ignore
    } finally {
      setMemLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchMemories(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open, fetchMemories]);

  const filteredCards = query.trim()
    ? cards.filter(c =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.id.toLowerCase().includes(query.toLowerCase())
      )
    : cards;

  const filteredSt = query.trim()
    ? stMemories.filter(m =>
        m.content.toLowerCase().includes(query.toLowerCase()) ||
        m.slug.toLowerCase().includes(query.toLowerCase())
      )
    : stMemories;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col transition-all duration-300 ${
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — rolls down from top */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full bg-zinc-900/98 border-b border-white/10 flex flex-col transition-transform duration-300 ${
          open ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{ height: '85vh' }}
      >
        {/* Search header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-white/10 shrink-0">
          <svg
            className="w-5 h-5 text-zinc-500 shrink-0"
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
            placeholder="Search cards, memos, and knowledge..."
            className="flex-1 bg-transparent text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none shrink-0"
            aria-label={t('closePanel')}
          >
            ✕
          </button>
        </div>

        {/* 3-column body */}
        <div className="flex-1 flex flex-row overflow-hidden min-h-0 divide-x divide-white/10">

          {/* Column 1: Cards */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/5 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Cards
                <span className="ml-2 text-zinc-600 font-normal normal-case tracking-normal">
                  {filteredCards.length}
                </span>
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              {filteredCards.length === 0 ? (
                <p className="text-sm text-zinc-600 text-center py-8">
                  {query.trim() ? 'No cards match.' : 'No cards.'}
                </p>
              ) : (
                filteredCards.map(card => (
                  <button
                    key={card.id}
                    onClick={() => { onClose(); onCardClick(card); }}
                    className="w-full text-left px-3 py-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-700/50 border border-white/5 hover:border-white/10 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm text-zinc-100 font-medium leading-snug line-clamp-2 group-hover:text-white">
                        {card.title}
                      </span>
                      <span className={`text-[10px] shrink-0 mt-0.5 font-semibold uppercase ${PRIORITY_COLORS[card.priority] ?? 'text-zinc-400'}`}>
                        {card.priority}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{STATE_LABELS[card.state] ?? card.state}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Column 2: Memos (STM) */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/5 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Memos
                <span className="ml-1.5 text-zinc-600 font-normal normal-case tracking-normal text-[9px]">STM</span>
                <span className="ml-2 text-zinc-600 font-normal normal-case tracking-normal">
                  {filteredSt.length}
                </span>
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              {memLoading ? (
                <p className="text-xs text-zinc-600 text-center py-8">Loading...</p>
              ) : filteredSt.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-8">
                  {query.trim() ? 'No memos match.' : 'No short-term memos.'}
                </p>
              ) : (
                filteredSt.map(m => (
                  <div
                    key={m.slug}
                    className="px-3 py-2.5 rounded-lg bg-zinc-800/40 border border-white/5"
                  >
                    <div className="text-[10px] font-mono text-zinc-500 mb-1">{m.slug}</div>
                    <p className="text-xs text-zinc-300 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                      {m.content.replace(/^<!--.*?-->\n?/s, '').replace(/^#[^\n]+\n/m, '').trim()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 3: Knowledgebase (LTM) */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/5 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Knowledgebase
                <span className="ml-1.5 text-zinc-600 font-normal normal-case tracking-normal text-[9px]">LTM</span>
                <span className="ml-2 text-zinc-600 font-normal normal-case tracking-normal">
                  {ltMemories.length}
                </span>
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              {memLoading ? (
                <p className="text-xs text-zinc-600 text-center py-8">Loading...</p>
              ) : ltMemories.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-8">
                  {query.trim() ? 'No knowledge matches.' : 'No long-term knowledge.'}
                </p>
              ) : (
                ltMemories.map(m => (
                  <div
                    key={m.id}
                    className="px-3 py-2.5 rounded-lg bg-zinc-800/40 border border-white/5"
                  >
                    {m.topic && (
                      <div className="text-[10px] font-mono text-zinc-500 mb-1">{m.topic}</div>
                    )}
                    <p className="text-xs text-zinc-300 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                      {m.content.trim()}
                    </p>
                    <div className="mt-1.5 text-[10px] text-zinc-600">
                      {new Date(m.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
