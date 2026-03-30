import { describe, it, expect, beforeEach } from 'bun:test';
import { createTestDb } from '../client.test';
import { runMigrations } from '../migrations';
import { createCard, listCards, getCard, updateCard, moveCard, checkDepGate } from '../cards';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];

beforeEach(() => {
  const instance = createTestDb();
  db = instance.db;
  sqlite = instance.sqlite;
  runMigrations(db, sqlite);
});

describe('cards', () => {
  it('creates a card', () => {
    const card = createCard(db, { title: 'Test card' });
    expect(card.title).toBe('Test card');
    expect(card.state).toBe('backlog');
    expect(card.priority).toBe('normal');
  });

  it('lists cards', () => {
    createCard(db, { title: 'A' });
    createCard(db, { title: 'B' });
    expect(listCards(db).length).toBe(2);
  });

  it('filters by state', () => {
    const card = createCard(db, { title: 'A' });
    moveCard(db, card.id, 'in-progress');
    expect(listCards(db, { state: 'in-progress' }).length).toBe(1);
    expect(listCards(db, { state: 'backlog' }).length).toBe(0);
  });

  it('updates work log', () => {
    const card = createCard(db, { title: 'A' });
    updateCard(db, card.id, { workLogEntry: { timestamp: '2024-01-01T00:00:00Z', message: 'did stuff' } });
    const updated = getCard(db, card.id);
    expect(updated?.workLog).toHaveLength(1);
    expect(updated?.workLog[0].message).toBe('did stuff');
  });

  it('updateCard preserves state when adding a note', () => {
    const card = createCard(db, { title: 'A' });
    moveCard(db, card.id, 'in-progress');
    updateCard(db, card.id, { workLogEntry: { timestamp: '2024-01-01T00:00:00Z', message: 'a note' } });
    const updated = getCard(db, card.id);
    expect(updated?.state).toBe('in-progress');
  });

  it('updateCard persists deps field', () => {
    const dep = createCard(db, { title: 'Dep card' });
    const card = createCard(db, { title: 'Main card' });
    updateCard(db, card.id, { deps: [dep.id] });
    const updated = getCard(db, card.id);
    expect((updated as { deps?: string[] })?.deps).toEqual([dep.id]);
  });
});

describe('checkDepGate', () => {
  it('blocks when dep is not shipped', () => {
    const dep = createCard(db, { title: 'Blocker' });
    // dep is in backlog by default
    const card = createCard(db, { title: 'Main' });
    updateCard(db, card.id, { deps: [dep.id] });
    const failures = checkDepGate(db, card.id);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0]).toContain('Blocker');
    expect(failures[0]).toContain('backlog');
  });

  it('passes when all deps are shipped', () => {
    const dep = createCard(db, { title: 'Done dep' });
    moveCard(db, dep.id, 'in-progress');
    moveCard(db, dep.id, 'in-review');
    moveCard(db, dep.id, 'shipped');
    const card = createCard(db, { title: 'Main' });
    updateCard(db, card.id, { deps: [dep.id] });
    const failures = checkDepGate(db, card.id);
    expect(failures).toHaveLength(0);
  });

  it('passes when card has no deps', () => {
    const card = createCard(db, { title: 'No deps' });
    const failures = checkDepGate(db, card.id);
    expect(failures).toHaveLength(0);
  });
});
