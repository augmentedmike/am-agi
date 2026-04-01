'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Card } from './BoardClient';
import { useCardPanel } from '@/contexts/CardPanelContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATE_PILL: Record<string, string> = {
  shipped: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'in-review': 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  'in-progress': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  backlog: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function fmtMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function toLocalDatetimeString(iso: string): string {
  // Convert ISO to local midnight-aligned date for comparison
  return new Date(iso).toDateString();
}

// ── CalendarPanel ─────────────────────────────────────────────────────────────

export function CalendarPanel({
  open,
  projectId,
  onClose,
}: {
  open: boolean;
  projectId: string | null;
  onClose: () => void;
}) {
  const { openCard } = useCardPanel();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => new Date());

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

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const today = new Date();
  const monthStart = startOfMonth(viewMonth);
  const totalDays = daysInMonth(viewMonth);
  const startDow = monthStart.getDay(); // 0=Sun

  // Scheduled cards: only those with a scheduledAt value
  const scheduledCards = cards.filter(c => c.scheduledAt);

  // Map: "datestring" → Card[]
  const byDay = new Map<string, Card[]>();
  for (const card of scheduledCards) {
    const key = new Date(card.scheduledAt!).toDateString();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(card);
  }

  const unscheduledCards = cards.filter(c => !c.scheduledAt);

  // Cards for selected day
  const selectedDayCards = selectedDay
    ? (byDay.get(selectedDay.toDateString()) ?? [])
    : [];

  // ── Month grid cells ──────────────────────────────────────────────────────

  // Grid: leading blanks + day cells
  const gridCells: (null | number)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  function prevMonth() {
    setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  function goToday() {
    const now = new Date();
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now);
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[140] bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel — slides up from bottom */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[150] flex flex-col bg-zinc-900/98 backdrop-blur-md border-t border-white/10 transition-transform duration-300 max-h-[80vh] ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
              Calendar
            </span>
            <span className="text-xs text-zinc-600">{fmtMonthYear(viewMonth)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="text-xs text-zinc-500 hover:text-zinc-200 px-2 py-1 rounded border border-white/10 hover:border-white/20 transition-colors"
            >
              Today
            </button>
            <button
              onClick={prevMonth}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition-colors"
              aria-label="Previous month"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition-colors"
              aria-label="Next month"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none ml-1">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              Loading…
            </div>
          ) : (
            <>
              {/* Month grid — left column */}
              <div className="shrink-0 w-full sm:w-64 border-b sm:border-b-0 sm:border-r border-white/10 overflow-y-auto">
                {/* Weekday header */}
                <div className="grid grid-cols-7 border-b border-white/5">
                  {WEEKDAYS.map(d => (
                    <div key={d} className="text-center text-[10px] font-semibold text-zinc-600 py-1.5 uppercase tracking-wide">
                      {d}
                    </div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7">
                  {gridCells.map((day, i) => {
                    if (day === null) {
                      return <div key={`blank-${i}`} className="aspect-square" />;
                    }
                    const cellDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
                    const isToday = isSameDay(cellDate, today);
                    const isSelected = selectedDay ? isSameDay(cellDate, selectedDay) : false;
                    const hasDot = byDay.has(cellDate.toDateString());
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(cellDate)}
                        className={`aspect-square flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors rounded-sm mx-0.5 my-0.5 ${
                          isSelected
                            ? 'bg-pink-500/20 text-pink-300 ring-1 ring-pink-500/60'
                            : isToday
                              ? 'ring-1 ring-pink-500/40 text-pink-300'
                              : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                        }`}
                      >
                        <span>{day}</span>
                        {hasDot && (
                          <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-pink-400' : 'bg-pink-500/70'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Daily agenda — right column */}
              <div className="flex-1 overflow-y-auto">
                {selectedDay ? (
                  <>
                    {/* Day heading */}
                    <div className="sticky top-0 z-10 px-4 py-2 bg-zinc-900/98 border-b border-white/10 flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-300">
                        {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </span>
                      {selectedDayCards.length > 0 && (
                        <span className="text-xs text-zinc-600">
                          {selectedDayCards.length} card{selectedDayCards.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* 24 hourly rows */}
                    <div className="flex flex-col">
                      {Array.from({ length: 24 }, (_, hour) => {
                        const hourCards = selectedDayCards.filter(c => {
                          if (!c.scheduledAt) return false;
                          return new Date(c.scheduledAt).getHours() === hour;
                        });
                        return (
                          <div key={hour} className={`flex items-start gap-3 px-3 py-1.5 border-b border-white/[0.04] min-h-[36px] ${hourCards.length > 0 ? 'bg-white/[0.02]' : ''}`}>
                            <span className="text-[10px] font-mono text-zinc-600 w-9 shrink-0 pt-0.5">
                              {String(hour).padStart(2, '0')}:00
                            </span>
                            <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                              {hourCards.map(card => (
                                <button
                                  key={card.id}
                                  onClick={() => openCard(card)}
                                  title={card.title}
                                  className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded border truncate max-w-[220px] hover:opacity-80 transition-opacity ${STATE_PILL[card.state] ?? STATE_PILL.backlog}`}
                                >
                                  <span className="truncate">{card.title}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
                    Select a day to see scheduled cards.
                  </div>
                )}

                {/* Unscheduled section */}
                {unscheduledCards.length > 0 && (
                  <div className="border-t border-white/10 px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 mb-2">
                      Unscheduled ({unscheduledCards.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {unscheduledCards.map(card => (
                        <button
                          key={card.id}
                          onClick={() => openCard(card)}
                          title={card.title}
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded border truncate max-w-[220px] hover:opacity-80 transition-opacity ${STATE_PILL[card.state] ?? STATE_PILL.backlog}`}
                        >
                          <span className="truncate">{card.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
