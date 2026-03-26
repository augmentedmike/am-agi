import type { Card } from '@/components/BoardClient';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface MonthTick {
  label: string;
  leftPct: number;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Returns month boundary ticks across the given date range.
 * Each tick has a short month label and a leftPct (0–100) position.
 */
export function getMonthTicks(range: DateRange): MonthTick[] {
  const totalMs = range.end.getTime() - range.start.getTime();
  if (totalMs <= 0) return [];

  const ticks: MonthTick[] = [];

  // Start from the 1st of the month containing range.start
  const d = new Date(range.start);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);

  while (d.getTime() <= range.end.getTime()) {
    const leftPct = ((d.getTime() - range.start.getTime()) / totalMs) * 100;
    ticks.push({
      label: MONTH_LABELS[d.getMonth()],
      leftPct: Math.max(0, Math.min(100, leftPct)),
    });
    d.setMonth(d.getMonth() + 1);
  }

  return ticks;
}

export interface BarDimensions {
  leftPct: number;
  widthPct: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns the global date range across all cards.
 * start = earliest createdAt; end = latest of (shippedAt or today).
 */
export function getDateRange(cards: Card[]): DateRange {
  if (cards.length === 0) {
    const now = new Date();
    return { start: now, end: now };
  }

  let minMs = Infinity;
  let maxMs = -Infinity;

  for (const c of cards) {
    const created = new Date(c.createdAt).getTime();
    if (created < minMs) minMs = created;

    const terminal = c.shippedAt
      ? new Date(c.shippedAt).getTime()
      : Date.now();
    if (terminal > maxMs) maxMs = terminal;
  }

  // ensure end is at least today
  if (Date.now() > maxMs) maxMs = Date.now();

  return { start: new Date(minMs), end: new Date(maxMs) };
}

/**
 * Returns {start, end} timestamps for the card's active phase:
 * - shipped     : inProgressAt (or createdAt) → shippedAt
 * - in-review   : inReviewAt (or inProgressAt or createdAt) → now
 * - in-progress : inProgressAt (or createdAt) → now
 * - backlog     : createdAt → createdAt + 1 day (nominal)
 */
export function phaseDuration(card: Card): DateRange {
  const createdAt = new Date(card.createdAt);
  const now = new Date();

  if (card.state === 'shipped' && card.shippedAt) {
    const start = card.inProgressAt ? new Date(card.inProgressAt) : createdAt;
    return { start, end: new Date(card.shippedAt) };
  }

  if (card.state === 'in-review' && card.inReviewAt) {
    return { start: new Date(card.inReviewAt), end: now };
  }

  if (card.state === 'in-progress' && card.inProgressAt) {
    return { start: new Date(card.inProgressAt), end: now };
  }

  // backlog — nominal 1-day width
  return { start: createdAt, end: new Date(createdAt.getTime() + MS_PER_DAY) };
}

/**
 * Like getDateRange but extends the end to cover projected backlog completion.
 * Adds padding on both sides so bars aren't flush against the edges.
 */
export function computeRangeWithProjection(cards: Card[], velocity: number): DateRange {
  const base = getDateRange(cards);
  const backlogCount = cards.filter(c => c.state === 'backlog').length;
  const projectedDays = velocity > 0 ? backlogCount / velocity : 30; // fallback 30d padding
  const projectedEnd = new Date(Date.now() + projectedDays * MS_PER_DAY);

  const end = projectedEnd > base.end ? projectedEnd : base.end;
  // Add 5% padding on each side so bars aren't flush at the edges
  const totalMs = end.getTime() - base.start.getTime();
  const pad = totalMs * 0.05;

  return {
    start: new Date(base.start.getTime() - pad),
    end: new Date(end.getTime() + pad),
  };
}

/**
 * Converts phase {start, end} into CSS left% and width% relative to rangeStart/rangeEnd.
 * Clamps to valid bounds and enforces a minimum visible width of 0.5%.
 */
export function barPosition(
  start: Date,
  end: Date,
  rangeStart: Date,
  rangeEnd: Date,
): BarDimensions {
  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  if (totalMs <= 0) return { leftPct: 0, widthPct: 100 };

  const startOffset = start.getTime() - rangeStart.getTime();
  const duration = Math.max(end.getTime() - start.getTime(), MS_PER_DAY);

  const leftPct = Math.max(0, Math.min(100, (startOffset / totalMs) * 100));
  const widthPct = Math.max(0.5, Math.min(100 - leftPct, (duration / totalMs) * 100));

  return { leftPct, widthPct };
}
