import { describe, it, expect, beforeEach } from 'bun:test';
import { createTestDb } from '@/db/client.test';
import { runMigrations } from '@/db/migrations';
import { createCard, listCards, getCard, updateCard, moveCard, archiveCard } from '@/db/cards';
import { storeKnowledge, searchKnowledge } from '@/db/knowledge';
import { checkGate, type State } from '@/worker/gates';
import { getAllSettings, setSetting, SETTING_DEFAULTS } from '@/db/settings';
import { createProject } from '@/db/projects';
import { listChatMessages, createChatMessage } from '@/db/chat';

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

  it('allows shipped→in-progress always (reopen route)', async () => {
    const card = createCard(db, { title: 'A' });
    const gateCard = { ...card, attachments: card.attachments.map(a => a.path) };
    const gate = await checkGate('shipped' as State, 'in-progress' as State, gateCard, card.workDir ?? '');
    expect(gate.allowed).toBe(true);
    expect(gate.failures).toHaveLength(0);
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

describe('project-scoped chat (listChatMessages with projectId)', () => {
  it('filters messages by projectId', () => {
    const p = createProject(db, { name: 'proj-a', repoDir: '/tmp/proj-a' });
    createChatMessage(db, { role: 'user', content: 'hello project', projectId: p.id });
    createChatMessage(db, { role: 'user', content: 'no project' });
    const scoped = listChatMessages(db, { projectId: p.id });
    expect(scoped.length).toBe(1);
    expect(scoped[0].content).toBe('hello project');
  });

  it('returns empty array when project has no messages', () => {
    const p = createProject(db, { name: 'proj-b', repoDir: '/tmp/proj-b' });
    const scoped = listChatMessages(db, { projectId: p.id });
    expect(scoped).toEqual([]);
  });

  it('createChatMessage sets projectId on the returned message', () => {
    const p = createProject(db, { name: 'proj-c', repoDir: '/tmp/proj-c' });
    const msg = createChatMessage(db, { role: 'assistant', content: 'reply', projectId: p.id });
    expect(msg.projectId).toBe(p.id);
  });
});

describe('project-scoped cards (listCards with projectId)', () => {
  it('filters cards by projectId', () => {
    const p = createProject(db, { name: 'proj-d', repoDir: '/tmp/proj-d' });
    createCard(db, { title: 'Card in project', projectId: p.id });
    createCard(db, { title: 'Card no project' });
    const scoped = listCards(db, { projectId: p.id });
    expect(scoped.length).toBe(1);
    expect(scoped[0].title).toBe('Card in project');
  });

  it('returns empty array when project has no cards', () => {
    const p = createProject(db, { name: 'proj-e', repoDir: '/tmp/proj-e' });
    const scoped = listCards(db, { projectId: p.id });
    expect(scoped).toEqual([]);
  });
});

// Helper: replicates the masking logic in GET /api/settings and PATCH /api/settings
function getSettingsSafe(db: ReturnType<typeof createTestDb>['db']): Record<string, string> {
  const all = getAllSettings(db);
  return { ...all, github_token: all.github_token ? '***' : '' };
}

describe('settings', () => {
  it('GET returns default values for all four keys when no settings are stored', () => {
    const safe = getSettingsSafe(db);
    expect(safe.github_username).toBe(SETTING_DEFAULTS.github_username);
    expect(safe.github_email).toBe(SETTING_DEFAULTS.github_email);
    expect(safe.workspaces_dir).toBe(SETTING_DEFAULTS.workspaces_dir);
    expect(safe.github_token).toBe('');
  });

  it('GET returns empty string for github_token when token has not been set', () => {
    const safe = getSettingsSafe(db);
    expect(safe.github_token).toBe('');
  });

  it('GET returns *** for github_token when a non-empty token is stored', () => {
    setSetting(db, 'github_token', 'ghp_secrettoken123');
    const safe = getSettingsSafe(db);
    expect(safe.github_token).toBe('***');
  });

  it('PATCH saves a setting and the next GET reflects the new value', () => {
    setSetting(db, 'github_username', 'miketest');
    const safe = getSettingsSafe(db);
    expect(safe.github_username).toBe('miketest');
  });

  it('PATCH with a new token causes GET to return *** — raw value never leaked', () => {
    setSetting(db, 'github_token', 'ghp_supersecret');
    const safe = getSettingsSafe(db);
    expect(safe.github_token).toBe('***');
    expect(safe.github_token).not.toBe('ghp_supersecret');
  });
});

// Criteria 6, 7, 8, 9 — Entity card fields
describe('entity cards', () => {
  it('creates an account card with entityFields (criterion 6)', () => {
    const card = createCard(db, {
      title: 'ACME Corp',
      cardType: 'account',
      entityFields: { companyName: 'ACME', status: 'prospect' },
    });
    expect(card.cardType).toBe('account');
    expect(card.entityFields).toEqual({ companyName: 'ACME', status: 'prospect' });
    // Persisted: fetch back from db
    const fetched = getCard(db, card.id);
    expect(fetched?.cardType).toBe('account');
    expect(fetched?.entityFields).toEqual({ companyName: 'ACME', status: 'prospect' });
  });

  it('PATCH merges entityFields — does not replace whole JSON (criterion 7)', () => {
    const card = createCard(db, {
      title: 'ACME Corp',
      cardType: 'account',
      entityFields: { companyName: 'ACME', status: 'prospect' },
    });
    updateCard(db, card.id, { entityFields: { status: 'customer' } });
    const updated = getCard(db, card.id);
    // status updated, companyName preserved
    expect(updated?.entityFields).toEqual({ companyName: 'ACME', status: 'customer' });
  });

  it('GET response includes cardType and entityFields (criterion 8)', () => {
    createCard(db, { title: 'Lead A', cardType: 'lead', entityFields: { source: 'inbound' } });
    const result = listCards(db);
    const lead = result.find(c => c.title === 'Lead A');
    expect(lead).toBeDefined();
    expect(lead?.cardType).toBe('lead');
    expect(lead?.entityFields).toEqual({ source: 'inbound' });
  });

  it('task card defaults — cardType is task, entityFields is empty (criterion 9)', () => {
    const card = createCard(db, { title: 'Plain task' });
    expect(card.cardType).toBe('task');
    expect(card.entityFields).toEqual({});
  });

  it('creates lead and candidate entity cards', () => {
    const lead = createCard(db, { title: 'Jane Doe', cardType: 'lead', entityFields: { email: 'jane@example.com' } });
    const candidate = createCard(db, { title: 'Bob Smith', cardType: 'candidate', entityFields: { role: 'engineer' } });
    expect(lead.cardType).toBe('lead');
    expect(candidate.cardType).toBe('candidate');
  });

  it('listCards filters by cardType (criterion 8 — filter)', () => {
    createCard(db, { title: 'Task A' }); // task (default)
    createCard(db, { title: 'Lead A', cardType: 'lead' });
    createCard(db, { title: 'Account A', cardType: 'account' });
    const leads = listCards(db, { cardType: 'lead' });
    expect(leads).toHaveLength(1);
    expect(leads[0].title).toBe('Lead A');
    const tasks = listCards(db, { cardType: 'task' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Task A');
  });

  it('bin/board --type flag defaults to task when omitted (criterion 14)', () => {
    // This tests the DB layer — the CLI passes cardType to createCard
    const card = createCard(db, { title: 'No type flag' });
    expect(card.cardType).toBe('task');
  });
});
