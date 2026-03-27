'use client';

import { useEffect } from 'react';
import { Card } from './BoardClient';
import { useLocale } from '@/contexts/LocaleContext';

const STATES = ['backlog', 'in-progress', 'in-review', 'shipped'] as const;

const STATE_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  shipped: 'Shipped',
};

const STATE_COLORS: Record<string, string> = {
  backlog: 'var(--color-state-backlog)',
  'in-progress': 'var(--color-state-in-progress)',
  'in-review': 'var(--color-state-in-review)',
  shipped: 'var(--color-state-shipped)',
};

const STATE_TEXT_COLORS: Record<string, string> = {
  backlog: 'text-state-backlog-fg',
  'in-progress': 'text-state-in-progress-fg',
  'in-review': 'text-state-in-review-fg',
  shipped: 'text-state-shipped-fg',
};

export function StatsPanel({
  open,
  onClose,
  cards,
}: {
  open: boolean;
  onClose: () => void;
  cards: Card[];
}) {
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const total = cards.length;
  const activeCount = cards.filter(c => !!c.workDir && c.state !== 'shipped').length;

  const counts = STATES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = cards.filter(c => c.state === s).length;
    return acc;
  }, {});

  const maxCount = Math.max(1, ...Object.values(counts));

  const BAR_HEIGHT = 80; // px, max bar height in SVG

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
        aria-label="Stats"
        className={`absolute inset-y-0 right-0 w-full sm:max-w-sm bg-zinc-900/95 backdrop-blur-md border-l border-white/10 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <span className="text-sm font-semibold uppercase tracking-wide text-zinc-400">{t('stats')}</span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none"
            aria-label={t('closeStats')}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-800/60 border border-white/5 rounded-xl px-4 py-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1">{t('total')}</p>
              <p className="text-3xl font-bold text-zinc-100">{total}</p>
            </div>
            <div className="bg-zinc-800/60 border border-white/5 rounded-xl px-4 py-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1">Active</p>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold text-emerald-400">{activeCount}</p>
                {activeCount > 0 && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Per-column counts */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">{t('byColumn')}</h3>
            <div className="space-y-2">
              {STATES.map(state => (
                <div key={state} className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${STATE_TEXT_COLORS[state]}`}>
                    {STATE_LABELS[state]}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        role="progressbar"
                        aria-label={STATE_LABELS[state]}
                        aria-valuenow={counts[state]}
                        aria-valuemin={0}
                        aria-valuemax={total}
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${total > 0 ? (counts[state] / total) * 100 : 0}%`,
                          backgroundColor: STATE_COLORS[state],
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-zinc-300 w-5 text-right">{counts[state]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SVG bar chart */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-4">{t('distribution')}</h3>
            <svg
              viewBox={`0 0 ${STATES.length * 56} ${BAR_HEIGHT + 32}`}
              className="w-full"
              aria-label="Card distribution bar chart"
            >
              {STATES.map((state, i) => {
                const barH = counts[state] > 0 ? Math.max(4, Math.round((counts[state] / maxCount) * BAR_HEIGHT)) : 2;
                const x = i * 56 + 8;
                const barW = 40;
                const y = BAR_HEIGHT - barH;

                return (
                  <g key={state}>
                    {/* Bar */}
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx={4}
                      fill={STATE_COLORS[state]}
                      opacity={counts[state] === 0 ? 0.2 : 0.85}
                    >
                      <title>{STATE_LABELS[state]}: {counts[state]}</title>
                    </rect>
                    {/* Count label */}
                    <text
                      x={x + barW / 2}
                      y={y - 5}
                      textAnchor="middle"
                      fontSize={10}
                      fill={counts[state] === 0 ? 'var(--color-zinc-600)' : 'var(--color-zinc-200)'}
                      fontWeight="600"
                    >
                      {counts[state]}
                    </text>
                    {/* State label */}
                    <text
                      x={x + barW / 2}
                      y={BAR_HEIGHT + 18}
                      textAnchor="middle"
                      fontSize={9}
                      fill="var(--color-zinc-500)"
                      fontWeight="500"
                    >
                      {state === 'in-progress' ? t('wip') : state === 'in-review' ? t('review') : STATE_LABELS[state]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
