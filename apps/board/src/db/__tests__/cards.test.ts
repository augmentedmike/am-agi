import { describe, it, expect, beforeEach } from 'bun:test';
import { createTestDb } from '../client.test';
import { runMigrations } from '../migrations';
import { createCard, listCards, getCard, updateCard, moveCard } from '../cards';

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
});
