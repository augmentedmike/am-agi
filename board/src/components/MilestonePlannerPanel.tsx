'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { Card } from './BoardClient';
import { getDateRange, phaseDuration, barPosition, getMonthTicks } from '@/lib/milestoneUtils';

// ── Constants ─────────────────────────────────────────────────────────────────

const PX_PER_DAY = 16;
const ROW_H = 36;        // px per card row
const AXIS_H = 36;       // px for the time axis header
const LABEL_W = 140;     // px for the left label column
const MS_PER_DAY = 24 * 60 * 60 * 1000;


/** Accent color per kanban state */
const PHASE_ACCENT: Record<string, string> = {
  backlog:      '#6b7280', // gray-500
  'in-progress': '#3b82f6', // blue-500
  'in-review':  '#f59e0b', // amber-500
  shipped:      '#10b981', // emerald-500
};

/** Priority → Tailwind classes for card bars */
const PRIORITY_COLORS: Record<Card['priority'], string> = {
  critical: 'bg-red-900/70 border-red-500/60 text-red-200',
  high:     'bg-orange-900/70 border-orange-500/60 text-orange-200',
  normal:   'bg-zinc-700/70 border-zinc-500/60 text-zinc-200',
  low:      'bg-zinc-800/50 border-zinc-600/40 text-zinc-400',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortCards(cards: Card[]): Card[] {
  const order: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
  return [...cards].sort((a, b) => {
    const pa = order[a.priority] ?? 99;
    const pb = order[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

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
  const t = useTranslations('MilestonePlannerPanel');
  const PHASES: { label: string; state: Card['state'] }[] = [
    { label: t('phaseBacklog'),    state: 'backlog'      },
    { label: t('phaseInProgress'), state: 'in-progress'  },
    { label: t('phaseInReview'),   state: 'in-review'    },
    { label: t('phaseShipped'),    state: 'shipped'      },
  ];
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch cards whenever the panel opens
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

  // Escape key closes
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose(); },
    [open, onClose],
  );
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const range = getDateRange(cards);
  const totalDays = Math.max(1, (range.end.getTime() - range.start.getTime()) / MS_PER_DAY);
  const timelineWidth = Math.max(800, Math.ceil(totalDays * PX_PER_DAY));

  const monthTicks = getMonthTicks(range);

  const nowPct =
    cards.length > 0
      ? Math.max(0, Math.min(100,
          ((Date.now() - range.start.getTime()) / (range.end.getTime() - range.start.getTime())) * 100,
        ))
      : 50;

  // Per-phase card sets and row heights
  const phaseData = PHASES.map(({ label, state }) => {
    const phaseCards = sortCards(cards.filter(c => c.state === state));
    const height = Math.max(1, phaseCards.length) * ROW_H;
    return { label, state, phaseCards, height };
  });

  // Cumulative top offsets for each phase group in the chart body
  const phaseOffsets: number[] = [];
  let acc = 0;
  for (const { height } of phaseData) {
    phaseOffsets.push(acc);
    acc += height;
  }
  const totalBodyHeight = acc;

  // ── Render ────────────────────────────────────────────────────────────────────

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
        className={`fixed inset-x-0 bottom-0 z-[150] flex flex-col bg-zinc-900 border-t border-white/10 transition-transform duration-300 max-h-[80vh] ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* ── Panel header ─────────────────────────────────────────────────── */}
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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable content ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
              Loading…
            </div>
          ) : (
            /* ── Gantt layout: fixed labels + scrollable timeline ──────────── */
            <div className="flex min-h-full">

              {/* Left label column — does NOT scroll horizontally */}
              <div
                className="flex-shrink-0 bg-zinc-900 border-r border-white/10 z-10"
                style={{ width: LABEL_W }}
              >
                {/* Spacer matching the time axis height */}
                <div
                  className="border-b border-white/10"
                  style={{ height: AXIS_H }}
                />
                {/* Phase labels */}
                {phaseData.map(({ label, state, phaseCards, height }) => (
                  <div
                    key={state}
                    className="flex items-start px-3 pt-2 gap-2"
                    style={{ height }}
                  >
                    {/* Colored accent line */}
                    <div
                      className="w-[3px] rounded-full mt-0.5 flex-shrink-0"
                      style={{ height: 16, backgroundColor: PHASE_ACCENT[state] }}
                    />
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider leading-none"
                        style={{ color: PHASE_ACCENT[state] }}>
                        {label}
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-0.5">
                        {phaseCards.length} card{phaseCards.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right timeline — scrolls horizontally */}
              <div className="flex-1 overflow-x-auto">
                <div style={{ width: timelineWidth, minWidth: timelineWidth }}>

                  {/* ── Time axis ──────────────────────────────────────────── */}
                  <div
                    className="relative border-b border-white/10 bg-zinc-900/80"
                    style={{ height: AXIS_H }}
                  >
                    {monthTicks.map((tick, i) => (
                      <div
                        key={`tick-${i}`}
                        className="absolute top-0 flex flex-col items-start"
                        style={{ left: `${tick.leftPct}%` }}
                      >
                        {/* Tick mark */}
                        <div className="w-px bg-white/10" style={{ height: 6, marginTop: 0 }} />
                        <span className="text-[10px] font-medium text-zinc-500 pl-1 leading-none mt-1">
                          {tick.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* ── Chart body ─────────────────────────────────────────── */}
                  <div className="relative" style={{ height: totalBodyHeight }}>

                    {/* Dashed month grid lines */}
                    {monthTicks.map((tick, i) => (
                      <div
                        key={`grid-${i}`}
                        className="absolute top-0 bottom-0 pointer-events-none"
                        style={{
                          left: `${tick.leftPct}%`,
                          width: 1,
                          borderLeft: '1px dashed rgba(255,255,255,0.07)',
                        }}
                      />
                    ))}

                    {/* Today marker — single line spanning full chart body height */}
                    <div
                      className="absolute top-0 bottom-0 z-20 pointer-events-none"
                      style={{ left: `${nowPct}%`, width: 1, backgroundColor: '#ec4899cc' }}
                      title="Today"
                    >
                      <span className="absolute top-1 left-1.5 text-[9px] font-semibold text-pink-400 whitespace-nowrap">
                        today
                      </span>
                    </div>

                    {/* Phase groups */}
                    {phaseData.map(({ state, phaseCards, height }, pi) => (
                      <div
                        key={state}
                        className="absolute left-0 right-0"
                        style={{ top: phaseOffsets[pi], height }}
                      >
                        {/* Subtle row separator */}
                        <div className="absolute top-0 left-0 right-0 h-px bg-white/[0.04]" />

                        {/* Card bars */}
                        {phaseCards.length === 0 ? (
                          <div
                            className="absolute inset-x-4 flex items-center"
                            style={{ top: 4, height: 28 }}
                          >
                            <span className="text-[10px] text-zinc-700 italic">
                              No cards
                            </span>
                          </div>
                        ) : (
                          phaseCards.map((card, idx) => {
                            const { start, end } = phaseDuration(card);
                            const { leftPct, widthPct } = barPosition(
                              start, end, range.start, range.end,
                            );
                            const colorClass =
                              PRIORITY_COLORS[card.priority as Card['priority']] ??
                              PRIORITY_COLORS.normal;

                            return (
                              <div
                                key={card.id}
                                className="absolute"
                                style={{
                                  top: idx * ROW_H + 4,
                                  left:  `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  height: 28,
                                }}
                              >
                                <div
                                  className={`flex items-center gap-1 px-2 h-full rounded border text-[11px] font-medium w-full overflow-hidden ${colorClass}`}
                                  title={card.title}
                                >
                                  {card.state === 'shipped' && (
                                    <span className="shrink-0 text-emerald-400 text-[10px]" aria-label="Shipped">✓</span>
                                  )}
                                  <span className="truncate">{card.title}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    ))}
                  </div>
                  {/* End chart body */}
                </div>
              </div>
              {/* End timeline */}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
