'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { Card } from './BoardClient';

const STATE_ORDER: Record<Card['state'], number> = {
  shipped: 0,
  'in-review': 1,
  'in-progress': 2,
  backlog: 3,
};

const STATE_BADGE: Record<Card['state'], { label: string; cls: string }> = {
  shipped: { label: 'Shipped', cls: 'bg-emerald-900/60 text-emerald-300 border-emerald-500/30' },
  'in-review': { label: 'In Review', cls: 'bg-sky-900/60 text-sky-300 border-sky-500/30' },
  'in-progress': { label: 'In Progress', cls: 'bg-violet-900/60 text-violet-300 border-violet-500/30' },
  backlog: { label: 'Backlog', cls: 'bg-zinc-800/60 text-zinc-400 border-zinc-600/30' },
};

const PRIORITY_DOT: Record<Card['priority'], string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  normal: 'bg-zinc-500',
  low: 'bg-zinc-700',
};

interface MilestonePlannerPanelProps {
  open: boolean;
  projectId: string | null;
  projectName: string;
  onClose: () => void;
}

export function MilestonePlannerPanel({
  open,
  projectId,
  projectName,
  onClose,
}: MilestonePlannerPanelProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const url = projectId
      ? `/api/cards?projectId=${encodeURIComponent(projectId)}`
      : '/api/cards';
    fetch(url)
      .then(r => r.json())
      .then((data: Card[]) => setCards(data))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose(); },
    [open, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Group cards by version — null/'' → null (No Version)
  const versionMap = new Map<string | null, Card[]>();
  for (const card of cards) {
    const v = card.version?.trim() || null;
    if (!versionMap.has(v)) versionMap.set(v, []);
    versionMap.get(v)!.push(card);
  }

  // Defined versions first (ascending), then null
  const versions = [...versionMap.keys()].sort((a, b) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  function velocity(vCards: Card[]): { shipped: number; total: number; pct: number } {
    const shipped = vCards.filter(c => c.state === 'shipped').length;
    const total = vCards.length;
    return { shipped, total, pct: total === 0 ? 0 : Math.round((shipped / total) * 100) };
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[140] bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-up panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Roadmap"
        className={`fixed inset-x-0 bottom-0 z-[150] flex flex-col bg-zinc-900/95 backdrop-blur-md border-t border-white/10 transition-transform duration-300 max-h-[80vh] ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Roadmap</span>
            {projectName && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-sm text-zinc-200 font-medium">{projectName}</span>
              </>
            )}
            {!loading && cards.length > 0 && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-xs text-zinc-500">
                  {cards.filter(c => c.state === 'shipped').length}/{cards.length} shipped
                </span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
            aria-label="Close roadmap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">Loading…</div>
          ) : cards.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">No cards in this project.</div>
          ) : (
            <div className="p-6 flex gap-5 overflow-x-auto">
              {versions.map(version => {
                const vCards = (versionMap.get(version) ?? []).sort(
                  (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state],
                );
                const vel = velocity(vCards);

                return (
                  <div
                    key={version ?? '__none__'}
                    className="flex-shrink-0 w-72 flex flex-col gap-3"
                  >
                    {/* Version header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-zinc-200 truncate">
                          {version ?? 'No Version'}
                        </span>
                        <span className="text-xs text-zinc-600 shrink-0">{vCards.length}</span>
                      </div>
                      {/* Velocity */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${vel.pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500 tabular-nums">
                          {vel.shipped}/{vel.total}
                        </span>
                      </div>
                    </div>

                    {/* Cards */}
                    <div className="flex flex-col gap-2">
                      {vCards.map(card => {
                        const badge = STATE_BADGE[card.state];
                        return (
                          <div
                            key={card.id}
                            className="bg-zinc-800/50 border border-white/8 rounded-lg px-3 py-2.5 flex flex-col gap-1.5 hover:bg-zinc-800/70 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[card.priority]}`}
                                title={card.priority}
                              />
                              <span className="text-sm text-zinc-100 leading-snug">{card.title}</span>
                            </div>
                            <div>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
