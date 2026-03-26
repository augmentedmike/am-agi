import { describe, it, expect } from 'bun:test';
import { countShippedInWindow, velocityPerDay } from '../velocityUtils';

// Fixed reference point: 2024-03-01T00:00:00.000Z
const NOW = new Date('2024-03-01T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * DAY_MS).toISOString();
}

// ---------------------------------------------------------------------------
// countShippedInWindow
// ---------------------------------------------------------------------------

describe('countShippedInWindow', () => {
  it('returns 0 for empty card list', () => {
    expect(countShippedInWindow([], 7, NOW)).toBe(0);
  });

  it('returns 0 when no cards are shipped within the window', () => {
    const cards = [
      { state: 'shipped', shippedAt: daysAgo(10) }, // outside 7-day window
      { state: 'in-progress', shippedAt: undefined },
    ];
    expect(countShippedInWindow(cards, 7, NOW)).toBe(0);
  });

  it('counts all cards shipped within the window', () => {
    const cards = [
      { state: 'shipped', shippedAt: daysAgo(1) },
      { state: 'shipped', shippedAt: daysAgo(3) },
      { state: 'shipped', shippedAt: daysAgo(6) },
    ];
    expect(countShippedInWindow(cards, 7, NOW)).toBe(3);
  });

  it('excludes cards shipped before the window boundary', () => {
    const cards = [
      { state: 'shipped', shippedAt: daysAgo(8) },  // outside
      { state: 'shipped', shippedAt: daysAgo(5) },  // inside
    ];
    expect(countShippedInWindow(cards, 7, NOW)).toBe(1);
  });

  it('includes a card shipped exactly at the window start boundary', () => {
    // exactly 7 days ago → shippedMs === windowStartMs → included
    const cards = [
      { state: 'shipped', shippedAt: daysAgo(7) },
    ];
    expect(countShippedInWindow(cards, 7, NOW)).toBe(1);
  });

  it('excludes cards with state shipped but shippedAt null', () => {
    const cards = [
      { state: 'shipped', shippedAt: null },
      { state: 'shipped', shippedAt: undefined },
    ];
    expect(countShippedInWindow(cards, 7, NOW)).toBe(0);
  });

  it('excludes non-shipped cards even if shippedAt is set', () => {
    const cards = [
      { state: 'in-progress', shippedAt: daysAgo(2) },
      { state: 'backlog', shippedAt: daysAgo(1) },
      { state: 'in-review', shippedAt: daysAgo(3) },
    ];
    expect(countShippedInWindow(cards, 7, NOW)).toBe(0);
  });

  it('7-day window counts correctly', () => {
    const cards = [
      { state: 'shipped', shippedAt: daysAgo(1) },
      { state: 'shipped', shippedAt: daysAgo(6) },
      { state: 'shipped', shippedAt: daysAgo(8) },  // outside
    ];
    expect(countShippedInWindow(cards, 7, NOW)).toBe(2);
  });

  it('14-day window counts correctly', () => {
    const cards = [
      { state: 'shipped', shippedAt: daysAgo(1) },
      { state: 'shipped', shippedAt: daysAgo(7) },
      { state: 'shipped', shippedAt: daysAgo(13) },
      { state: 'shipped', shippedAt: daysAgo(15) }, // outside
    ];
    expect(countShippedInWindow(cards, 14, NOW)).toBe(3);
  });

  it('30-day window counts correctly', () => {
    const cards = [
      { state: 'shipped', shippedAt: daysAgo(5) },
      { state: 'shipped', shippedAt: daysAgo(15) },
      { state: 'shipped', shippedAt: daysAgo(29) },
      { state: 'shipped', shippedAt: daysAgo(31) }, // outside
    ];
    expect(countShippedInWindow(cards, 30, NOW)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// velocityPerDay
// ---------------------------------------------------------------------------

describe('velocityPerDay', () => {
  it('returns 0 for empty list', () => {
    expect(velocityPerDay([], 7, NOW)).toBe(0);
  });

  it('returns count divided by windowDays', () => {
    const cards = [
      { state: 'shipped', shippedAt: daysAgo(1) },
      { state: 'shipped', shippedAt: daysAgo(3) },
    ];
    // 2 shipped in 7 days → 2/7
    expect(velocityPerDay(cards, 7, NOW)).toBeCloseTo(2 / 7);
  });

  it('returns 0 for windowDays <= 0', () => {
    const cards = [{ state: 'shipped', shippedAt: daysAgo(1) }];
    expect(velocityPerDay(cards, 0, NOW)).toBe(0);
  });

  it('computes correctly for 14-day window', () => {
    const cards = [
      { state: 'shipped', shippedAt: daysAgo(1) },
      { state: 'shipped', shippedAt: daysAgo(7) },
      { state: 'shipped', shippedAt: daysAgo(13) },
    ];
    expect(velocityPerDay(cards, 14, NOW)).toBeCloseTo(3 / 14);
  });

  it('computes correctly for 30-day window', () => {
    const cards = [
      { state: 'shipped', shippedAt: daysAgo(5) },
      { state: 'shipped', shippedAt: daysAgo(15) },
      { state: 'shipped', shippedAt: daysAgo(25) },
      { state: 'shipped', shippedAt: daysAgo(35) }, // outside
    ];
    expect(velocityPerDay(cards, 30, NOW)).toBeCloseTo(3 / 30);
  });
});
