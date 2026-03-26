'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { Card } from './BoardClient';
import { getDateRange, phaseDuration, barPosition } from '@/lib/milestoneUtils';

const PHASES: { label: string; state: Card['state'] }[] = [
  { label: 'Backlog', state: 'backlog' },
  { label: 'In Progress', state: 'in-progress' },
  { label: 'In Review', state: 'in-review' },
  { label: 'Shipped', state: 'shipped' },
];

const PRIORITY_COLORS: Record<Card['priority'], string> = {
  critical: 'bg-red-900/60 border-red-500/60 text-red-200',
  high: 'bg-orange-900/60 border-orange-500/60 text-orange-200',
  normal: 'bg-zinc-700/60 border-zinc-500/60 text-zinc-200',
  low: 'bg-zinc-800/40 border-zinc-600/40 text-zinc-400',
};

function sortCards(cards: Card[]): Card[] {
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
    AI: 4,
  };
  return [...cards].sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 99;
    const pb = priorityOrder[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

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

  // Fetch cards when panel opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const url = projectId
      ? `/api/cards?projectId=${encodeURIComponent(projectId)}`
      : '/api/cards?projectId=';
    fetch(url)
      .then(r => r.json())
      .then((data: Card[]) => setCards(data))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  // Escape key closes the panel
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    },
    [open, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const range = getDateRange(cards);
  const nowPct =
    cards.length > 0
      ? Math.max(
          0,
          Math.min(
            100,
            ((Date.now() - range.start.getTime()) /
              (range.end.getTime() - range.start.getTime())) *
              100,
          ),
        )
      : 50;

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
            <span className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Roadmap
            </span>
            {projectName && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-sm text-zinc-200 font-medium">{projectName}</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
            aria-label="Close roadmap"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
              Loading…
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {PHASES.map(({ label, state }) => {
                const phaseCards = sortCards(cards.filter(c => c.state === state));
                return (
                  <div key={state}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 w-24 shrink-0">
                        {label}
                      </span>
                      <span className="text-xs text-zinc-600">({phaseCards.length})</span>
                    </div>

                    {phaseCards.length === 0 ? (
                      <div className="h-8 flex items-center px-3 rounded-md border border-dashed border-zinc-800 text-xs text-zinc-600 italic">
                        No cards in this phase
                      </div>
                    ) : (
                      /* Horizontal scroll container */
                      <div className="overflow-x-auto">
                        <div className="relative min-w-full" style={{ minWidth: '600px', height: `${phaseCards.length * 36 + 8}px` }}>
                          {/* Today marker */}
                          <div
                            className="absolute top-0 bottom-0 w-px bg-pink-500/70 z-10"
                            style={{ left: `${nowPct}%` }}
                            title="Today"
                          >
                            <span className="absolute -top-5 left-1 text-[10px] text-pink-400 whitespace-nowrap font-medium">
                              today
                            </span>
                          </div>

                          {/* Card bars */}
                          {phaseCards.map((card, idx) => {
                            const { start, end } = phaseDuration(card);
                            const { leftPct, widthPct } = barPosition(
                              start,
                              end,
                              range.start,
                              range.end,
                            );
                            const colorClass =
                              PRIORITY_COLORS[card.priority as Card['priority']] ?? PRIORITY_COLORS.normal;
                            const isShipped = card.state === 'shipped';

                            return (
                              <div
                                key={card.id}
                                className="absolute flex items-center"
                                style={{
                                  top: `${idx * 36 + 4}px`,
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  height: '28px',
                                }}
                              >
                                <div
                                  className={`flex items-center gap-1 px-2 h-full rounded border text-xs font-medium w-full overflow-hidden ${colorClass}`}
                                  title={card.title}
                                >
                                  {isShipped && (
                                    <span className="shrink-0 text-emerald-400" aria-label="Shipped">
                                      ✓
                                    </span>
                                  )}
                                  <span className="truncate">{card.title}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
