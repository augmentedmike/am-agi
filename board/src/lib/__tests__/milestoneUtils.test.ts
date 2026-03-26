import { describe, it, expect } from 'bun:test';
import { getMonthTicks } from '../milestoneUtils';

describe('getMonthTicks', () => {
  it('returns empty array when range is zero-length', () => {
    const d = new Date('2024-03-15T00:00:00.000Z');
    expect(getMonthTicks({ start: d, end: d })).toEqual([]);
  });

  it('includes the month of range.start even mid-month', () => {
    const range = {
      start: new Date('2024-03-15T00:00:00.000Z'),
      end:   new Date('2024-05-01T00:00:00.000Z'),
    };
    const ticks = getMonthTicks(range);
    const labels = ticks.map(t => t.label);
    expect(labels).toContain('Mar');
    expect(labels).toContain('Apr');
    expect(labels).toContain('May');
  });

  it('leftPct of first tick is ≤ 0 when start is mid-month', () => {
    const range = {
      start: new Date('2024-03-15T00:00:00.000Z'),
      end:   new Date('2024-06-01T00:00:00.000Z'),
    };
    const ticks = getMonthTicks(range);
    // Mar 1 is before range.start, so leftPct should be clamped to 0
    expect(ticks[0].leftPct).toBe(0);
  });

  it('ticks are in ascending leftPct order', () => {
    const range = {
      start: new Date('2024-01-01T00:00:00.000Z'),
      end:   new Date('2024-06-30T00:00:00.000Z'),
    };
    const ticks = getMonthTicks(range);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].leftPct).toBeGreaterThanOrEqual(ticks[i - 1].leftPct);
    }
  });

  it('leftPct values are within [0, 100]', () => {
    const range = {
      start: new Date('2024-01-01T00:00:00.000Z'),
      end:   new Date('2024-12-31T00:00:00.000Z'),
    };
    const ticks = getMonthTicks(range);
    for (const tick of ticks) {
      expect(tick.leftPct).toBeGreaterThanOrEqual(0);
      expect(tick.leftPct).toBeLessThanOrEqual(100);
    }
  });

  it('returns 12 ticks for a full calendar year', () => {
    const range = {
      start: new Date('2024-01-01T00:00:00.000Z'),
      end:   new Date('2024-12-31T23:59:59.999Z'),
    };
    const ticks = getMonthTicks(range);
    expect(ticks.length).toBe(12);
    expect(ticks[0].label).toBe('Jan');
    expect(ticks[11].label).toBe('Dec');
  });

  it('first tick leftPct is 0 when range starts on the 1st', () => {
    const range = {
      start: new Date('2024-04-01T00:00:00.000Z'),
      end:   new Date('2024-07-01T00:00:00.000Z'),
    };
    const ticks = getMonthTicks(range);
    expect(ticks[0].label).toBe('Apr');
    expect(ticks[0].leftPct).toBe(0);
  });
});
