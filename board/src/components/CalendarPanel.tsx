'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Card } from './BoardClient';
import { useCardPanel } from '@/contexts/CardPanelContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type RecurrenceRule = 'daily' | 'weekly' | 'monthly' | 'weekdays' | null;

interface EventOccurrence {
  card: Card;
  date: Date; // the specific occurrence date
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtDateInput(d: Date): string {
  // YYYY-MM-DD
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getRecurrenceLabel(rule: RecurrenceRule): string {
  if (!rule) return 'Does not repeat';
  if (rule === 'daily') return 'Every day';
  if (rule === 'weekly') return 'Every week';
  if (rule === 'monthly') return 'Every month';
  if (rule === 'weekdays') return 'Every weekday (Mon–Fri)';
  return 'Does not repeat';
}

// Expand a recurring card into all occurrences within [rangeStart, rangeEnd)
function getOccurrences(card: Card, rangeStart: Date, rangeEnd: Date): EventOccurrence[] {
  if (!card.scheduledAt) return [];
  const baseDate = new Date(card.scheduledAt);
  const rule = (card.entityFields?.recurrenceRule as RecurrenceRule) ?? null;

  if (!rule) {
    // One-time event
    if (baseDate >= rangeStart && baseDate < rangeEnd) {
      return [{ card, date: baseDate }];
    }
    return [];
  }

  const results: EventOccurrence[] = [];
  const MAX_ITER = 400;
  let current = new Date(baseDate);
  let iter = 0;

  while (current < rangeEnd && iter++ < MAX_ITER) {
    if (current >= rangeStart) {
      results.push({ card, date: new Date(current) });
    }
    if (rule === 'daily') {
      current = addDays(current, 1);
    } else if (rule === 'weekly') {
      current = addDays(current, 7);
    } else if (rule === 'monthly') {
      current = addMonths(current, 1);
    } else if (rule === 'weekdays') {
      do { current = addDays(current, 1); } while (current.getDay() === 0 || current.getDay() === 6);
    } else {
      break;
    }
  }

  return results;
}

// ── Event color by card state ─────────────────────────────────────────────────

const EVENT_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  shipped:      { bg: 'bg-emerald-500/25', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  'in-review':  { bg: 'bg-sky-500/25',     text: 'text-sky-300',     dot: 'bg-sky-400' },
  'in-progress':{ bg: 'bg-violet-500/25',  text: 'text-violet-300',  dot: 'bg-violet-400' },
  backlog:      { bg: 'bg-[#0a84ff]/20',   text: 'text-[#0a84ff]',  dot: 'bg-[#0a84ff]' },
};
function evtColor(state: string) {
  return EVENT_COLOR[state] ?? EVENT_COLOR.backlog;
}

// ── New Event Form ────────────────────────────────────────────────────────────

function NewEventModal({
  defaultDate,
  projectId,
  onCreated,
  onCancel,
}: {
  defaultDate: Date;
  projectId: string | null;
  onCreated: (card: Card) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(fmtDateInput(defaultDate));
  const [time, setTime] = useState('09:00');
  const [allDay, setAllDay] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceRule>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const scheduledAt = allDay
        ? new Date(`${date}T00:00:00`).toISOString()
        : new Date(`${date}T${time}:00`).toISOString();

      const body: Record<string, unknown> = {
        title: title.trim(),
        priority: 'normal',
        scheduledAt,
        ...(projectId && { projectId }),
        ...(recurrence && { entityFields: { recurrenceRule: recurrence } }),
      };

      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? `Error ${res.status}`);
        setSaving(false);
        return;
      }
      onCreated(await res.json());
    } catch {
      setError('Network error');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#2c2c2e', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <button onClick={onCancel} className="text-[#0a84ff] text-sm font-medium">Cancel</button>
          <span className="text-white font-semibold text-sm">New Event</span>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="text-[#0a84ff] text-sm font-semibold disabled:opacity-40"
          >
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          <textarea
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Event title or description"
            rows={3}
            className="w-full bg-transparent text-white placeholder-white/30 text-base resize-none focus:outline-none"
            onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
          />

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="rounded-xl overflow-hidden" style={{ background: '#3a3a3c' }}>
            {/* All day toggle */}
            <label className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] cursor-pointer">
              <span className="text-white text-sm">All-day</span>
              <input
                type="checkbox"
                checked={allDay}
                onChange={e => setAllDay(e.target.checked)}
                className="w-4 h-4 accent-[#0a84ff]"
              />
            </label>

            {/* Date */}
            <label className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
              <span className="text-white text-sm">Date</span>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-transparent text-[#0a84ff] text-sm focus:outline-none text-right"
              />
            </label>

            {/* Time */}
            {!allDay && (
              <label className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
                <span className="text-white text-sm">Time</span>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="bg-transparent text-[#0a84ff] text-sm focus:outline-none text-right"
                />
              </label>
            )}

            {/* Recurrence */}
            <label className="flex items-center justify-between px-4 py-3">
              <span className="text-white text-sm">Repeat</span>
              <select
                value={recurrence ?? ''}
                onChange={e => setRecurrence((e.target.value || null) as RecurrenceRule)}
                className="bg-transparent text-[#0a84ff] text-sm focus:outline-none text-right"
              >
                <option value="">Never</option>
                <option value="daily">Every Day</option>
                <option value="weekdays">Every Weekday</option>
                <option value="weekly">Every Week</option>
                <option value="monthly">Every Month</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEventDate, setNewEventDate] = useState<Date>(() => new Date());

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
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape' && !showNewEvent) onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, showNewEvent]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const today = new Date();
  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const monthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
  const totalDays = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const startDow = monthStart.getDay();

  // Expand all cards (including recurring) for this month
  const allOccurrences = cards.flatMap(card => getOccurrences(card, monthStart, monthEnd));

  // Map: datestring → EventOccurrence[]
  const byDay = new Map<string, EventOccurrence[]>();
  for (const occ of allOccurrences) {
    const key = startOfDay(occ.date).toDateString();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(occ);
  }

  // Events for selected day
  const selectedDayOccs = byDay.get(startOfDay(selectedDay).toDateString()) ?? [];
  // Sort by time
  const sortedDayOccs = [...selectedDayOccs].sort((a, b) =>
    new Date(a.card.scheduledAt!).getTime() - new Date(b.card.scheduledAt!).getTime()
  );

  // Grid cells
  const gridCells: (null | number)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (gridCells.length % 7 !== 0) gridCells.push(null);

  function prevMonth() { setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }
  function goToday() {
    const now = new Date();
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now);
  }

  function handleDayClick(day: number) {
    const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    setSelectedDay(d);
  }

  function handleAddEvent(day?: Date) {
    setNewEventDate(day ?? selectedDay);
    setShowNewEvent(true);
  }

  function handleEventCreated(card: Card) {
    setCards(prev => [...prev, card]);
    setShowNewEvent(false);
    // Navigate to the event's date
    if (card.scheduledAt) {
      const d = new Date(card.scheduledAt);
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      setSelectedDay(d);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Full-viewport overlay */}
      <div
        className="fixed inset-0 z-[150] flex flex-col"
        style={{ background: '#1c1c1e', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
      >
        {/* ── Top bar ───────────────────────────────────────────────────── */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Left: close */}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
          >
            <svg className="h-4 w-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Center: Month + Year with nav */}
          <div className="flex items-center gap-3">
            <button
              onClick={prevMonth}
              className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/10 transition-colors"
            >
              <svg className="h-4 w-4 text-[#0a84ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-white font-semibold text-base min-w-[160px] text-center select-none">
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </span>
            <button
              onClick={nextMonth}
              className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/10 transition-colors"
            >
              <svg className="h-4 w-4 text-[#0a84ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Right: Today + Add */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="text-[#0a84ff] text-sm font-medium px-3 py-1 rounded-full hover:bg-[#0a84ff]/10 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => handleAddEvent()}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
              title="New event"
            >
              <svg className="h-5 w-5 text-[#0a84ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="flex-1 flex min-h-0">
          {/* ── Calendar grid ──────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 shrink-0 px-1 pt-2 pb-1">
              {WEEKDAYS_SHORT.map(d => (
                <div
                  key={d}
                  className="text-center text-[11px] font-semibold select-none"
                  style={{ color: d === 'SUN' || d === 'SAT' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.45)' }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Grid rows */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <svg className="animate-spin h-6 w-6 text-white/30" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
              </div>
            ) : (
              <div className="flex-1 grid grid-rows-[repeat(6,1fr)] px-1 pb-1 min-h-0">
                {Array.from({ length: Math.ceil(gridCells.length / 7) }, (_, rowIdx) => (
                  <div key={rowIdx} className="grid grid-cols-7 min-h-0">
                    {gridCells.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
                      if (day === null) {
                        return (
                          <div
                            key={`blank-${rowIdx}-${colIdx}`}
                            style={{ borderRight: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                          />
                        );
                      }
                      const cellDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
                      const isToday = isSameDay(cellDate, today);
                      const isSelected = isSameDay(cellDate, selectedDay);
                      const dayOccs = byDay.get(cellDate.toDateString()) ?? [];
                      const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;

                      return (
                        <button
                          key={day}
                          onClick={() => handleDayClick(day)}
                          className="flex flex-col items-start p-1.5 min-h-0 transition-colors hover:bg-white/[0.04] text-left"
                          style={{
                            borderRight: '1px solid rgba(255,255,255,0.05)',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            background: isSelected ? 'rgba(10,132,255,0.12)' : undefined,
                          }}
                        >
                          {/* Date number */}
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full mb-0.5 shrink-0"
                            style={{
                              background: isToday ? '#ff453a' : isSelected ? '#0a84ff' : 'transparent',
                              color: isToday || isSelected ? '#fff' : isWeekend ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)',
                            }}
                          >
                            {day}
                          </span>

                          {/* Event pills — show up to 3 */}
                          <div className="flex flex-col gap-0.5 w-full min-h-0 overflow-hidden">
                            {dayOccs.slice(0, 3).map((occ, i) => {
                              const c = evtColor(occ.card.state);
                              return (
                                <div
                                  key={`${occ.card.id}-${i}`}
                                  className={`text-[10px] font-medium px-1 py-0.5 rounded truncate w-full leading-tight ${c.bg} ${c.text}`}
                                >
                                  {occ.card.title}
                                </div>
                              );
                            })}
                            {dayOccs.length > 3 && (
                              <span className="text-[9px] text-white/30 pl-1">+{dayOccs.length - 3} more</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Day detail panel ──────────────────────────────────── */}
          <div
            className="shrink-0 w-72 flex flex-col"
            style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}
          >
            {/* Day heading */}
            <div
              className="shrink-0 px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div>
                <div className="text-white font-semibold text-sm">
                  {WEEKDAYS_LONG[selectedDay.getDay()]}
                </div>
                <div className="text-white/50 text-xs">
                  {MONTHS[selectedDay.getMonth()]} {selectedDay.getDate()}, {selectedDay.getFullYear()}
                </div>
              </div>
              <button
                onClick={() => handleAddEvent(selectedDay)}
                className="flex items-center gap-1 text-[#0a84ff] text-xs font-medium px-2 py-1 rounded-full hover:bg-[#0a84ff]/10 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add
              </button>
            </div>

            {/* Event list */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {sortedDayOccs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 gap-2">
                  <span className="text-white/20 text-sm">No events</span>
                  <button
                    onClick={() => handleAddEvent(selectedDay)}
                    className="text-[#0a84ff] text-xs hover:underline"
                  >
                    Add one
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {sortedDayOccs.map((occ, i) => {
                    const c = evtColor(occ.card.state);
                    const isRecurring = !!(occ.card.entityFields?.recurrenceRule);
                    return (
                      <button
                        key={`${occ.card.id}-${i}`}
                        onClick={() => openCard(occ.card)}
                        className={`w-full text-left rounded-xl px-3 py-2.5 transition-opacity hover:opacity-80 ${c.bg}`}
                      >
                        <div className={`text-sm font-medium leading-snug ${c.text}`}>
                          {occ.card.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {occ.card.scheduledAt && (
                            <span className="text-[11px] text-white/40">
                              {fmtTime(occ.card.scheduledAt)}
                            </span>
                          )}
                          {isRecurring && (
                            <span className="text-[11px] text-white/30 flex items-center gap-0.5">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              {getRecurrenceLabel(occ.card.entityFields?.recurrenceRule as RecurrenceRule)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1">
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 capitalize"
                          >
                            {occ.card.state}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New event modal */}
      {showNewEvent && (
        <NewEventModal
          defaultDate={newEventDate}
          projectId={projectId}
          onCreated={handleEventCreated}
          onCancel={() => setShowNewEvent(false)}
        />
      )}
    </>
  );
}
