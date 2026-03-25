'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CardColumn } from './CardColumn';
import { CardPanel } from './CardPanel';

type WorkLogEntry = { timestamp: string; message: string };
type Attachment = { path: string; name: string };

export type Card = {
  id: string;
  title: string;
  state: 'backlog' | 'in-progress' | 'in-review' | 'shipped';
  priority: 'critical' | 'high' | 'normal' | 'low';
  attachments: Attachment[];
  workLog: WorkLogEntry[];
  workDir: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATES = ['backlog', 'in-progress', 'in-review', 'shipped'] as const;

export function BoardClient({ initialCards }: { initialCards: Card[] }) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const es = new EventSource('/api/ws');
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'card_created') {
          setCards(prev => {
            // Avoid duplicates if we already added via optimistic update
            if (prev.some(c => c.id === event.card.id)) return prev;
            return [...prev, event.card];
          });
        } else if (event.type === 'card_moved') {
          setCards(prev => prev.map(c => c.id === event.card.id ? event.card : c));
          // Update selected card if it moved
          setSelectedCard(prev => prev?.id === event.card.id ? event.card : prev);
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  // Polling fallback: refetch cards every 5 seconds
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/cards');
        if (!res.ok) return;
        const fresh: Card[] = await res.json();
        setCards(fresh);
        setSelectedCard(prev => prev ? (fresh.find(c => c.id === prev.id) ?? null) : null);
      } catch {}
    }, 5_000);
    return () => clearInterval(id);
  }, []);

  const handleCardClick = useCallback((card: Card) => {
    setSelectedCard(card);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedCard(null);
  }, []);

  const handleToggleNewPanel = useCallback(() => {
    setPanelOpen(prev => !prev);
  }, []);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewTitle(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  const handleCreate = useCallback(async () => {
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        const card: Card = await res.json();
        // Optimistic / immediate update
        setCards(prev => {
          if (prev.some(c => c.id === card.id)) return prev;
          return [...prev, card];
        });
        setNewTitle('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        setPanelOpen(false);
      }
    } finally {
      setCreating(false);
    }
  }, [newTitle, creating]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCreate();
    }
  }, [handleCreate]);

  const activeCount = cards.filter(c => !!c.workDir && c.state !== 'shipped').length;

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-zinc-950">
      <header className="shrink-0 px-6 py-4 border-b border-white/5 bg-zinc-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">AM Board</h1>
          <div className="flex items-center gap-3">
            {activeCount > 0 && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
            <span className="text-sm text-zinc-400">
              {activeCount} active
            </span>
            <button
              onClick={handleToggleNewPanel}
              className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                panelOpen
                  ? 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30'
                  : 'bg-pink-500/10 text-pink-400 hover:bg-pink-500/20'
              }`}
            >
              + new card
            </button>
          </div>
        </div>
      </header>

      {/* Slide-down new card panel */}
      <div
        className={`shrink-0 overflow-hidden transition-all duration-200 ease-in-out bg-zinc-900/60 border-b border-white/5 ${
          panelOpen ? 'max-h-40' : 'max-h-0'
        }`}
      >
        <div className="px-6 py-4 flex flex-col gap-3">
          <textarea
            ref={textareaRef}
            value={newTitle}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Describe the work…"
            rows={1}
            className="w-full bg-zinc-800/60 border border-white/10 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 resize-none overflow-hidden focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/30"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || creating}
              className="text-sm font-medium px-3 py-1.5 rounded-md bg-pink-500 text-white hover:bg-pink-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? 'creating…' : 'Create'}
            </button>
            <span className="text-xs text-zinc-500">or ⌘↵</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-row overflow-hidden">
        {STATES.map(state => (
          <CardColumn
            key={state}
            state={state}
            cards={cards.filter(c => c.state === state)}
            onCardClick={handleCardClick}
          />
        ))}
      </div>
      <CardPanel card={selectedCard} onClose={handleClosePanel} />
    </div>
  );
}
