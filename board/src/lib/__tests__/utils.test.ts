import { describe, it, expect } from 'bun:test';
import { truncateTitle } from '../utils';

describe('truncateTitle', () => {
  it('returns the title unchanged when shorter than 100 chars', () => {
    const short = 'Hello world';
    expect(truncateTitle(short)).toBe(short);
  });

  it('returns the title unchanged when exactly 100 chars', () => {
    const exact = 'a'.repeat(100);
    expect(truncateTitle(exact)).toBe(exact);
    expect(truncateTitle(exact).length).toBe(100);
  });

  it('truncates and appends ellipsis when longer than 100 chars', () => {
    const long = 'a'.repeat(150);
    const result = truncateTitle(long);
    expect(result).toBe('a'.repeat(100) + '…');
    expect(result.length).toBe(101); // 100 chars + ellipsis char
  });

  it('truncates at the correct boundary with mixed content', () => {
    // 101 chars — one over the limit
    const title = 'cards in board should should be truncated after 100 chars (including spaces) and this part is extra!!';
    const result = truncateTitle(title);
    expect(result.length).toBeLessThanOrEqual(101); // 100 + ellipsis
    expect(result.endsWith('…')).toBe(true);
  });

  it('respects a custom max parameter', () => {
    const title = 'Hello, world!';
    expect(truncateTitle(title, 5)).toBe('Hello…');
    expect(truncateTitle(title, 50)).toBe(title);
  });

  it('handles empty string', () => {
    expect(truncateTitle('')).toBe('');
  });
});
