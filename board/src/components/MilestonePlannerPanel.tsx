'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Card } from './BoardClient';
import { getMonthTicks, barPosition, computeRangeWithProjection } from '@/lib/milestoneUtils';
import { velocityPerDay } from '@/lib/velocityUtils';
import { useLocale } from '@/contexts/LocaleContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const VELOCITY_WINDOWS = [
  { label: '24h', days: 1 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '360d', days: 360 },
] as const;

const STATE_ORDER: Record<string, number> = {
  shipped: 0,
  'in-review': 1,
  'in-progress': 2,
  backlog: 3,
};

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  normal: 'bg-zinc-500',
  low: 'bg-zinc-600',
};

const STATE_BADGE: Record<string, string> = {
  shipped: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  'in-review': 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  'in-progress': 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  backlog: 'bg-zinc-500/10 text-zinc-500 border-zinc-600/20',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function versionSort(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return a.localeCompare(b);
}

interface VersionBars {
  shippedBar: { leftPct: number; widthPct: number } | null;
  inFlightBar: { leftPct: number; widthPct: number } | null;
  projectedBar: { leftPct: number; widthPct: number } | null;
  isComplete: boolean;
  lastShippedAt: Date | null;
  estComplete: Date | null;
  shippedCount: number;
  inFlightCount: number;
  backlogCount: number;
  totalCount: number;
}

function computeVersionBars(
  cards: Card[],
  rangeStart: Date,
  rangeEnd: Date,
  velocity: number,
): VersionBars {
  const shipped = cards.filter(c => c.state === 'shipped');
  const inFlight = cards.filter(c => c.state === 'in-progress' || c.state === 'in-review');
  const backlog = cards.filter(c => c.state === 'backlog');
  const today = new Date();

  const shippedStart = shipped.length
    ? new Date(Math.min(...shipped.map(c => +new Date(c.inProgressAt ?? c.createdAt))))
    : null;
  const shippedEnd = shipped.length
    ? new Date(Math.max(...shipped.map(c => +new Date(c.shippedAt ?? c.updatedAt))))
    : null;

  const inFlightStart = inFlight.length
    ? new Date(Math.min(...inFlight.map(c => +new Date(c.inProgressAt ?? c.inReviewAt ?? c.createdAt))))
    : null;

  const backlogDays = velocity > 0 ? backlog.length / velocity : null;
  const projectedEnd = backlogDays !== null && backlog.length > 0
    ? new Date(+today + backlogDays * 86_400_000)
    : null;

  const isComplete = backlog.length === 0 && inFlight.length === 0;

  return {
    shippedBar: shippedStart && shippedEnd ? barPosition(shippedStart, shippedEnd, rangeStart, rangeEnd) : null,
    inFlightBar: inFlightStart ? barPosition(inFlightStart, today, rangeStart, rangeEnd) : null,
    projectedBar: projectedEnd ? barPosition(today, projectedEnd, rangeStart, rangeEnd) : null,
    isComplete,
    lastShippedAt: shippedEnd,
    estComplete: isComplete ? shippedEnd : projectedEnd,
    shippedCount: shipped.length,
    inFlightCount: inFlight.length,
    backlogCount: backlog.length,
    totalCount: cards.length,
  };
}

// ── VersionRow ────────────────────────────────────────────────────────────────

function VersionRow({
  version,
  cards,
  bars,
  todayPct,
  expanded,
  onToggle,
}: {
  version: string;
  cards: Card[];
  bars: VersionBars;
  todayPct: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  void todayPct; // used by parent for TODAY line positioning
  const sortedCards = [...cards].sort((a, b) =>
    (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9)
  );

  const completionLabel = bars.isComplete
    ? bars.lastShippedAt ? `✓ ${fmtDate(bars.lastShippedAt)}` : '✓ Complete'
    : bars.estComplete
      ? `est. ${fmtDateShort(bars.estComplete)}`
      : bars.backlogCount > 0
        ? 'est. ? (no velocity)'
        : null;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-0 hover:bg-white/[0.02] transition-colors text-left"
      >
        {/* Version label */}
        <div className="shrink-0 w-[90px] px-3 py-3">
          <div className="flex items-center gap-1">
            <svg className={`h-2.5 w-2.5 shrink-0 transition-transform text-zinc-600 ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-xs font-mono font-semibold text-zinc-300 truncate">{version}</span>
          </div>
          <div className="text-[10px] text-zinc-600 mt-0.5 pl-3.5">
            {bars.shippedCount}/{bars.totalCount}
          </div>
        </div>

        {/* Timeline bar area */}
        <div className="flex-1 py-3 pr-2 min-w-0">
          <div className="relative h-5">
            {bars.shippedBar && (
              <div
                className="absolute top-0 h-full rounded bg-emerald-500/70"
                style={{ left: `${bars.shippedBar.leftPct}%`, width: `${bars.shippedBar.widthPct}%` }}
              />
            )}
            {bars.inFlightBar && (
              <div
                className="absolute top-0 h-full rounded bg-amber-400/60"
                style={{ left: `${bars.inFlightBar.leftPct}%`, width: `${bars.inFlightBar.widthPct}%` }}
              />
            )}
            {bars.projectedBar && (
              <div
                className="absolute top-0 h-full rounded border border-dashed border-zinc-500/50 bg-zinc-700/20"
                style={{ left: `${bars.projectedBar.leftPct}%`, width: `${bars.projectedBar.widthPct}%` }}
              />
            )}
          </div>
        </div>

        {/* Completion label */}
        <div className="shrink-0 w-[130px] pr-4 text-right">
          {completionLabel && (
            <span className={`text-[11px] font-medium ${bars.isComplete ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {completionLabel}
            </span>
          )}
        </div>
      </button>

      {/* Expanded card list — shipped only */}
      {expanded && (
        <div className="border-t border-white/5 bg-zinc-900/40 pl-[90px] pr-4 py-2 flex flex-col gap-0.5">
          {sortedCards.filter(c => c.state === 'shipped').map(card => (
            <div key={card.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-white/5 transition-colors">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[card.priority] ?? 'bg-zinc-500'}`} />
              <span className="text-xs text-zinc-300 flex-1 truncate">{card.title}</span>
              {card.shippedAt && (
                <span className="text-[10px] text-zinc-500 shrink-0 w-16 text-right">{fmtDate(new Date(card.shippedAt))}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MilestonePlannerPanel({
  open,
  projectId,
  projectName,
  onClose,
}: {
  open: boolean;
  projectId: string | null;
  projectName: string;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const url = projectId ? `/api/cards?projectId=${projectId}` : `/api/cards`;
      const res = await fetch(url);
      if (res.ok) setCards(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) fetchCards();
  }, [open, fetchCards]);

  // Auto-expand all versions when cards load
  useEffect(() => {
    if (cards.length > 0) {
      const versions = new Set(cards.map(c => c.version?.trim() || '—'));
      setExpandedVersions(versions);
    }
  }, [cards]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const velocity = velocityPerDay(cards, 1); // use 24h velocity for projection
  const velocities = VELOCITY_WINDOWS.map(w => ({
    label: w.label,
    value: velocityPerDay(cards, w.days),
  }));
  const range = computeRangeWithProjection(cards, velocity);
  const ticks = getMonthTicks(range);
  const todayPct = Math.max(0, Math.min(100,
    ((Date.now() - range.start.getTime()) / (range.end.getTime() - range.start.getTime())) * 100
  ));

  // Group by version
  const byVersion = new Map<string, Card[]>();
  for (const card of cards) {
    const v = card.version?.trim() || '—';
    if (!byVersion.has(v)) byVersion.set(v, []);
    byVersion.get(v)!.push(card);
  }

  const sortedVersions = [...byVersion.keys()].sort((a, b) => {
    if (a === '—') return 1;
    if (b === '—') return -1;
    return versionSort(a, b);
  });

  function toggleVersion(v: string) {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  }

  const velocityLabel = velocity > 0
    ? `${velocity.toFixed(2)} cards/day`
    : 'no recent velocity';

  // LEFT_COL and RIGHT_COL widths must match the VersionRow layout
  const LEFT_COL = 90;
  const RIGHT_COL = 134; // 130px label + 4px gap

  return (
    <>
      <div
        className={`fixed inset-0 z-overlay bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <div
        className={`fixed inset-x-0 bottom-0 z-modal flex flex-col bg-zinc-900/98 backdrop-blur-md border-t border-white/10 transition-transform duration-300 max-h-[50vh] sm:max-h-[70vh] ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-3 sm:px-6 py-3 border-b border-white/10">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
              {t('roadmap')}{projectName ? ` — ${projectName}` : ''}
            </span>
            <span className="text-xs text-zinc-600">{velocityLabel}</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Velocity stats — all windows shown simultaneously */}
            <div className="flex items-center gap-3">
              {velocities.map(v => (
                <div key={v.label} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-600 font-medium">{v.label}</span>
                  <span className="text-[11px] font-mono font-semibold text-zinc-300">
                    {v.value > 0 ? `${v.value.toFixed(1)}/d` : '—'}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-sm gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              {t('loading')}
            </div>
          ) : cards.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
              No cards{projectId ? ' in this project' : ''}.
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Date column header — sticky across top */}
              <div className="shrink-0 sticky top-0 z-20 flex border-b border-white/10 bg-zinc-900/98" style={{ height: '28px' }}>
                <div className="shrink-0" style={{ width: `${LEFT_COL}px` }} />
                <div className="flex-1 relative min-w-0">
                  {/* TODAY marker */}
                  <div
                    className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none z-10"
                    style={{ left: `calc((100% - ${RIGHT_COL}px) * ${todayPct / 100})` }}
                  >
                    <div className="w-px h-full bg-pink-500/50" />
                  </div>
                  {/* Month labels */}
                  {ticks.map((tick, i) => (
                    <span
                      key={i}
                      className="absolute text-[9px] sm:text-[10px] text-zinc-500 top-1/2 -translate-y-1/2 -translate-x-1/2 select-none font-medium"
                      style={{ left: `calc((100% - ${RIGHT_COL}px) * ${tick.leftPct / 100})` }}
                    >
                      {tick.label}
                    </span>
                  ))}
                  {/* TODAY label */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ left: `calc((100% - ${RIGHT_COL}px) * ${todayPct / 100})` }}
                  >
                    <span className="text-[9px] text-pink-400/90 font-semibold ml-1">TODAY</span>
                  </div>
                </div>
                <div className="shrink-0" style={{ width: `${RIGHT_COL}px` }} />
              </div>

              {/* Rows */}
              {sortedVersions.map(version => {
                const vCards = byVersion.get(version)!;
                const bars = computeVersionBars(vCards, range.start, range.end, velocity);
                return (
                  <div key={version} className="border-b border-white/5 relative">
                    {/* TODAY vertical line — scoped to this row */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-pink-500/20 pointer-events-none z-10"
                      style={{ left: `calc(${LEFT_COL}px + (100% - ${LEFT_COL + RIGHT_COL}px) * ${todayPct / 100})` }}
                    />
                    <VersionRow
                      version={version}
                      cards={vCards}
                      bars={bars}
                      todayPct={todayPct}
                      expanded={expandedVersions.has(version)}
                      onToggle={() => toggleVersion(version)}
                    />
                  </div>
                );
              })}

              {/* Legend */}
              <div className="shrink-0 px-6 py-2 border-t border-white/5 flex items-center gap-5">
                <span className="flex items-center gap-1.5 text-[10px] text-zinc-600"><span className="w-3 h-2 rounded bg-emerald-500/70 inline-block" /> Shipped</span>
                <span className="flex items-center gap-1.5 text-[10px] text-zinc-600"><span className="w-3 h-2 rounded bg-amber-400/60 inline-block" /> In flight</span>
                <span className="flex items-center gap-1.5 text-[10px] text-zinc-600"><span className="w-3 h-2 rounded border border-dashed border-zinc-500/50 bg-zinc-700/20 inline-block" /> Projected</span>
                <span className="flex items-center gap-1.5 text-[10px] text-zinc-600"><span className="w-px h-3 bg-pink-500/50 inline-block" /> Today</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
