import { describe, it, expect, beforeEach } from 'bun:test';
import { createTestDb } from '@/db/client.test';
import { runMigrations } from '@/db/migrations';
import { createCard, listCards, getCard, updateCard, moveCard, archiveCard } from '@/db/cards';
import { storeKnowledge, searchKnowledge } from '@/db/knowledge';
import { checkGate, type State } from '@/worker/gates';

// Route handler tests exercise the db functions + gate logic that route handlers wrap.
// Next.js-specific imports (NextRequest, NextResponse) are not available in bun test,
// so we test the logic layer directly with in-memory SQLite.

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];

beforeEach(() => {
  const instance = createTestDb();
  db = instance.db;
  sqlite = instance.sqlite;
  runMigrations(db, sqlite);
});

describe('GET /api/cards', () => {
  it('returns all cards', () => {
    createCard(db, { title: 'A' });
    createCard(db, { title: 'B' });
    const result = listCards(db);
    expect(result.length).toBe(2);
  });

  it('filters by state', () => {
    const c = createCard(db, { title: 'A' });
    moveCard(db, c.id, 'in-progress');
    expect(listCards(db, { state: 'in-progress' }).length).toBe(1);
    expect(listCards(db, { state: 'backlog' }).length).toBe(0);
  });

  it('filters by priority', () => {
    createCard(db, { title: 'A', priority: 'critical' });
    createCard(db, { title: 'B', priority: 'low' });
    expect(listCards(db, { priority: 'critical' }).length).toBe(1);
  });
});

describe('POST /api/cards', () => {
  it('creates card with defaults', () => {
    const card = createCard(db, { title: 'New card' });
    expect(card.state).toBe('backlog');
    expect(card.priority).toBe('normal');
    expect(card.attachments).toEqual([]);
    expect(card.workLog).toEqual([]);
  });

  it('creates card with explicit priority', () => {
    const card = createCard(db, { title: 'High priority', priority: 'high' });
    expect(card.priority).toBe('high');
  });
});

describe('GET /api/cards/[id]', () => {
  it('returns card by id', () => {
    const card = createCard(db, { title: 'Detail card' });
    const found = getCard(db, card.id);
    expect(found).not.toBeNull();
    expect(found?.title).toBe('Detail card');
  });

  it('returns null for unknown id', () => {
    const found = getCard(db, 'nonexistent-id');
    expect(found).toBeUndefined();
  });
});

describe('PATCH /api/cards/[id]', () => {
  it('updates title', () => {
    const card = createCard(db, { title: 'Original' });
    const updated = updateCard(db, card.id, { title: 'Updated' });
    expect(updated?.title).toBe('Updated');
  });

  it('appends work log entry', () => {
    const card = createCard(db, { title: 'A' });
    updateCard(db, card.id, { workLogEntry: { timestamp: '2024-01-01T00:00:00Z', message: 'step one' } });
    updateCard(db, card.id, { workLogEntry: { timestamp: '2024-01-02T00:00:00Z', message: 'step two' } });
    const updated = getCard(db, card.id);
    expect(updated?.workLog).toHaveLength(2);
    expect(updated?.workLog[1].message).toBe('step two');
  });

  it('adds attachment', () => {
    const card = createCard(db, { title: 'A' });
    updateCard(db, card.id, { attachment: { path: '/tmp/criteria.md', name: 'criteria.md' } });
    const updated = getCard(db, card.id);
    expect(updated?.attachments).toHaveLength(1);
    expect(updated?.attachments[0].name).toBe('criteria.md');
  });
});

describe('POST /api/cards/[id]/move — gate enforcement', () => {
  it('rejects backlog→in-progress without required files', async () => {
    const card = createCard(db, { title: 'A' });
    const gateCard = { ...card, attachments: card.attachments.map(a => a.path) };
    const gate = await checkGate('backlog', 'in-progress', gateCard, card.workDir ?? '');
    expect(gate.allowed).toBe(false);
    expect(gate.failures.length).toBeGreaterThan(0);
  });

  it('allows in-review→in-progress always', async () => {
    const card = createCard(db, { title: 'A' });
    const gateCard = { ...card, attachments: card.attachments.map(a => a.path) };
    const gate = await checkGate('in-review', 'in-progress', gateCard, card.workDir ?? '');
    expect(gate.allowed).toBe(true);
  });

  it('rejects unknown transitions', async () => {
    const card = createCard(db, { title: 'A' });
    const gateCard = { ...card, attachments: card.attachments.map(a => a.path) };
    const gate = await checkGate('shipped' as State, 'backlog' as State, gateCard, card.workDir ?? '');
    expect(gate.allowed).toBe(false);
  });
});

describe('POST /api/cards/[id]/archive', () => {
  it('sets archived flag to true', () => {
    const card = createCard(db, { title: 'Done' });
    const archived = archiveCard(db, card.id);
    expect(archived?.archived).toBe(true);
  });
});

describe('POST /api/knowledge + GET /api/knowledge/search', () => {
  it('stores and retrieves knowledge by cosine similarity', () => {
    // Store two embeddings
    const embA = [1, 0, 0];
    const embB = [0, 1, 0];
    storeKnowledge(db, sqlite as Parameters<typeof storeKnowledge>[1], { content: 'topic A', embedding: embA, source: 'test' });
    storeKnowledge(db, sqlite as Parameters<typeof storeKnowledge>[1], { content: 'topic B', embedding: embB, source: 'test' });

    // Query with embedding close to A
    const results = searchKnowledge(db, [0.99, 0.01, 0], 2);
    expect(results.length).toBeGreaterThan(0);
    // Top result should be topic A (closest to query)
    expect(results[0].content).toBe('topic A');
  });
});
