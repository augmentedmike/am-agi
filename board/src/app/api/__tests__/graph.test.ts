import { describe, it, expect, beforeEach } from 'bun:test';
import { createTestDb } from '@/db/client.test';
import { runMigrations } from '@/db/migrations';
import {
  createEntity,
  getEntityById,
  updateEntity,
  deleteEntity,
  searchEntities,
  createRelation,
  deleteRelation,
  getNeighbors,
} from '@/db/graph';

let sqlite: ReturnType<typeof createTestDb>['sqlite'];

beforeEach(() => {
  const inst = createTestDb();
  sqlite = inst.sqlite;
  runMigrations(inst.db, inst.sqlite);
});

describe('createEntity', () => {
  it('creates entity with required fields', () => {
    const e = createEntity(sqlite, { type: 'person', name: 'Alice' });
    expect(e.id).toBeTruthy();
    expect(e.type).toBe('person');
    expect(e.name).toBe('Alice');
    expect(e.confidence).toBe(100);
    expect(e.aliases).toEqual([]);
  });

  it('creates entity with all optional fields', () => {
    const e = createEntity(sqlite, {
      type: 'company',
      name: 'Acme',
      summary: 'A company',
      aliases: ['ACME Corp'],
      properties: { founded: 1950 },
      confidence: 90,
      source: 'manual',
    });
    expect(e.summary).toBe('A company');
    expect(e.aliases).toEqual(['ACME Corp']);
    expect(e.properties).toEqual({ founded: 1950 });
    expect(e.confidence).toBe(90);
  });
});

describe('getEntityById', () => {
  it('returns entity for existing id', () => {
    const e = createEntity(sqlite, { type: 'person', name: 'Bob' });
    const found = getEntityById(sqlite, e.id);
    expect(found).not.toBeUndefined();
    expect(found?.name).toBe('Bob');
  });

  it('returns undefined for unknown id', () => {
    expect(getEntityById(sqlite, 'nonexistent')).toBeUndefined();
  });
});

describe('updateEntity', () => {
  it('updates fields', () => {
    const e = createEntity(sqlite, { type: 'person', name: 'Charlie' });
    const updated = updateEntity(sqlite, e.id, { name: 'Charles', summary: 'Updated' });
    expect(updated?.name).toBe('Charles');
    expect(updated?.summary).toBe('Updated');
  });

  it('returns undefined for unknown id', () => {
    expect(updateEntity(sqlite, 'bad-id', { name: 'X' })).toBeUndefined();
  });
});

describe('deleteEntity', () => {
  it('deletes existing entity', () => {
    const e = createEntity(sqlite, { type: 'person', name: 'Dave' });
    expect(deleteEntity(sqlite, e.id)).toBe(true);
    expect(getEntityById(sqlite, e.id)).toBeUndefined();
  });

  it('returns false for unknown id', () => {
    expect(deleteEntity(sqlite, 'ghost')).toBe(false);
  });
});

describe('searchEntities (FTS5)', () => {
  it('returns matching entities', () => {
    createEntity(sqlite, { type: 'person', name: 'Alice Smith' });
    createEntity(sqlite, { type: 'person', name: 'Bob Jones' });
    const results = searchEntities(sqlite, 'Alice');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Alice Smith');
  });

  it('returns empty array when no match', () => {
    createEntity(sqlite, { type: 'person', name: 'Alice' });
    const results = searchEntities(sqlite, 'Zephyr');
    expect(results).toEqual([]);
  });

  it('filters by type', () => {
    createEntity(sqlite, { type: 'person', name: 'Alice' });
    createEntity(sqlite, { type: 'company', name: 'Alice Corp' });
    const results = searchEntities(sqlite, 'Alice', 'person');
    expect(results.length).toBe(1);
    expect(results[0].type).toBe('person');
  });
});

describe('createRelation', () => {
  it('creates a relation between two entities', () => {
    const a = createEntity(sqlite, { type: 'person', name: 'A' });
    const b = createEntity(sqlite, { type: 'person', name: 'B' });
    const rel = createRelation(sqlite, { fromId: a.id, toId: b.id, relation: 'knows' });
    expect(rel.id).toBeTruthy();
    expect(rel.fromId).toBe(a.id);
    expect(rel.toId).toBe(b.id);
    expect(rel.relation).toBe('knows');
    expect(rel.weight).toBe(1);
  });
});

describe('deleteRelation', () => {
  it('deletes existing relation', () => {
    const a = createEntity(sqlite, { type: 'person', name: 'A' });
    const b = createEntity(sqlite, { type: 'person', name: 'B' });
    const rel = createRelation(sqlite, { fromId: a.id, toId: b.id, relation: 'knows' });
    expect(deleteRelation(sqlite, rel.id)).toBe(true);
  });

  it('returns false for unknown id', () => {
    expect(deleteRelation(sqlite, 'no-such-rel')).toBe(false);
  });
});

describe('getNeighbors', () => {
  it('returns outgoing and incoming neighbors', () => {
    const a = createEntity(sqlite, { type: 'person', name: 'A' });
    const b = createEntity(sqlite, { type: 'person', name: 'B' });
    const c = createEntity(sqlite, { type: 'person', name: 'C' });
    createRelation(sqlite, { fromId: a.id, toId: b.id, relation: 'knows' });
    createRelation(sqlite, { fromId: c.id, toId: a.id, relation: 'mentions' });

    const neighbors = getNeighbors(sqlite, a.id);
    expect(neighbors.length).toBe(2);
    const outgoing = neighbors.find(n => n.direction === 'outgoing');
    const incoming = neighbors.find(n => n.direction === 'incoming');
    expect(outgoing?.entity.name).toBe('B');
    expect(outgoing?.relation).toBe('knows');
    expect(incoming?.entity.name).toBe('C');
    expect(incoming?.relation).toBe('mentions');
  });

  it('returns empty array when no neighbors', () => {
    const a = createEntity(sqlite, { type: 'person', name: 'Lone' });
    expect(getNeighbors(sqlite, a.id)).toEqual([]);
  });
});
