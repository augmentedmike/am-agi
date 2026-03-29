import { describe, it, expect } from 'bun:test';
import { linkifyUUIDs } from './linkify';

const UUID = '41ffe03b-356f-45a5-9dec-1208155ace0f';
const UUID2 = '38155653-898d-4a2b-bc6b-b5fd7bc7faa9';

describe('linkifyUUIDs', () => {
  it('wraps a bare UUID in [[card:UUID]]', () => {
    expect(linkifyUUIDs(UUID)).toBe(`[[card:${UUID}]]`);
  });

  it('does not double-wrap an already-wrapped card reference', () => {
    const wrapped = `[[card:${UUID}]]`;
    expect(linkifyUUIDs(wrapped)).toBe(wrapped);
  });

  it('does not double-wrap [[project:UUID]] references', () => {
    const ref = `[[project:${UUID}]]`;
    expect(linkifyUUIDs(ref)).toBe(ref);
  });

  it('does not double-wrap [[iteration:UUID]] references', () => {
    const ref = `[[iteration:${UUID}]]`;
    expect(linkifyUUIDs(ref)).toBe(ref);
  });

  it('wraps UUID embedded in surrounding text, leaving non-UUID text alone', () => {
    const input = `check out ${UUID} for details`;
    expect(linkifyUUIDs(input)).toBe(`check out [[card:${UUID}]] for details`);
  });

  it('wraps multiple bare UUIDs', () => {
    const input = `${UUID} and ${UUID2}`;
    expect(linkifyUUIDs(input)).toBe(`[[card:${UUID}]] and [[card:${UUID2}]]`);
  });

  it('does not modify text with no UUIDs', () => {
    const plain = 'just a normal message';
    expect(linkifyUUIDs(plain)).toBe(plain);
  });

  it('handles mixed wrapped and bare UUIDs without double-wrapping', () => {
    const input = `[[card:${UUID}]] and bare ${UUID2}`;
    expect(linkifyUUIDs(input)).toBe(`[[card:${UUID}]] and bare [[card:${UUID2}]]`);
  });

  it('returns unchanged string when no UUIDs present (signals no-op to paste handler)', () => {
    const input = 'hello world';
    expect(linkifyUUIDs(input) === input).toBe(true);
  });
});
