import { describe, it, expect } from 'bun:test';
import { listSchema, createSchema } from '../cards/schema';
import { patchSchema } from '../cards/[id]/schema';
import { moveSchema } from '../cards/[id]/move/schema';
import { storeSchema } from '../knowledge/schema';
import { searchSchema } from '../knowledge/search/schema';

describe('listSchema', () => {
  it('accepts valid state filter', () => {
    const r = listSchema.safeParse({ state: 'backlog' });
    expect(r.success).toBe(true);
  });
  it('rejects invalid state', () => {
    const r = listSchema.safeParse({ state: 'invalid' });
    expect(r.success).toBe(false);
  });
  it('accepts empty object', () => {
    const r = listSchema.safeParse({});
    expect(r.success).toBe(true);
  });
});

describe('createSchema', () => {
  it('requires title', () => {
    const r = createSchema.safeParse({});
    expect(r.success).toBe(false);
  });
  it('rejects empty title', () => {
    const r = createSchema.safeParse({ title: '' });
    expect(r.success).toBe(false);
  });
  it('accepts title with optional fields', () => {
    const r = createSchema.safeParse({ title: 'My card', priority: 'high' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.title).toBe('My card');
      expect(r.data.priority).toBe('high');
    }
  });
  it('rejects invalid priority', () => {
    const r = createSchema.safeParse({ title: 'x', priority: 'urgent' });
    expect(r.success).toBe(false);
  });
});

describe('patchSchema', () => {
  it('accepts empty object (all optional)', () => {
    const r = patchSchema.safeParse({});
    expect(r.success).toBe(true);
  });
  it('accepts workLogEntry', () => {
    const r = patchSchema.safeParse({ workLogEntry: { timestamp: '2024-01-01T00:00:00Z', message: 'done' } });
    expect(r.success).toBe(true);
  });
  it('rejects workLogEntry missing message', () => {
    const r = patchSchema.safeParse({ workLogEntry: { timestamp: '2024-01-01T00:00:00Z' } });
    expect(r.success).toBe(false);
  });
});

describe('moveSchema', () => {
  it('accepts valid states', () => {
    for (const state of ['backlog', 'in-progress', 'in-review', 'shipped'] as const) {
      expect(moveSchema.safeParse({ state }).success).toBe(true);
    }
  });
  it('rejects missing state', () => {
    expect(moveSchema.safeParse({}).success).toBe(false);
  });
  it('rejects invalid state', () => {
    expect(moveSchema.safeParse({ state: 'done' }).success).toBe(false);
  });
});

describe('storeSchema', () => {
  it('requires content, embedding, source', () => {
    expect(storeSchema.safeParse({}).success).toBe(false);
  });
  it('accepts valid knowledge entry', () => {
    const r = storeSchema.safeParse({ content: 'hello', embedding: [0.1, 0.2], source: 'manual' });
    expect(r.success).toBe(true);
  });
  it('rejects empty content', () => {
    expect(storeSchema.safeParse({ content: '', embedding: [], source: 'x' }).success).toBe(false);
  });
});

describe('searchSchema', () => {
  it('requires q', () => {
    expect(searchSchema.safeParse({}).success).toBe(false);
  });
  it('accepts valid query', () => {
    const r = searchSchema.safeParse({ q: 'find something' });
    expect(r.success).toBe(true);
  });
  it('coerces limit from string', () => {
    const r = searchSchema.safeParse({ q: 'x', limit: '5' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(5);
  });
  it('rejects limit above 100', () => {
    expect(searchSchema.safeParse({ q: 'x', limit: '200' }).success).toBe(false);
  });
});
