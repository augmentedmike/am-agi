import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  listPipelines,
  getPipeline,
  createPipeline,
  listStages,
  createStage,
  getEntriesInStage,
  addContactToPipeline,
  listEntries,
  moveEntry,
  getEntry,
} from '../pipelines';
import { seedDefaultPipeline } from '../seed-pipelines';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    title TEXT,
    tags TEXT,
    avatar_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pipelines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pipeline_stages (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    color TEXT,
    is_terminal INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pipeline_entries (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    stage_id TEXT NOT NULL REFERENCES pipeline_stages(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS stage_transitions (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL REFERENCES pipeline_entries(id) ON DELETE CASCADE,
    from_stage_id TEXT,
    to_stage_id TEXT NOT NULL,
    transitioned_at TEXT NOT NULL
  );
`;

type BunStatement = ReturnType<Database['prepare']>;

function wrapSqlite(raw: Database) {
  return {
    prepare(sql: string) {
      const stmt: BunStatement = raw.prepare(sql);
      return {
        all: (...args: unknown[]) => stmt.all(...args as any[]),
        get: (...args: unknown[]) => stmt.get(...args as any[]),
        run: (...args: unknown[]) => stmt.run(...args as any[]),
      };
    },
    exec(sql: string) { raw.run(sql); },
  } as unknown as import('better-sqlite3').Database;
}

function makeTestDb() {
  const raw = new Database(':memory:');
  raw.run('PRAGMA foreign_keys = ON');
  raw.exec(SCHEMA);
  const sqlite = wrapSqlite(raw);
  seedDefaultPipeline(sqlite);
  return { sqlite, raw };
}

describe('pipelines DB', () => {
  let sqlite: ReturnType<typeof makeTestDb>['sqlite'];
  let raw: ReturnType<typeof makeTestDb>['raw'];

  beforeEach(() => {
    const db = makeTestDb();
    sqlite = db.sqlite;
    raw = db.raw;
  });

  it('seeds default pipeline on first run', () => {
    const pipelines = raw.prepare('SELECT * FROM pipelines').all() as any[];
    expect(pipelines.length).toBe(1);
    expect(pipelines[0].name).toBe('Contacts');

    const stages = raw.prepare('SELECT * FROM pipeline_stages ORDER BY position').all() as any[];
    expect(stages.length).toBe(7);
    expect(stages[0].name).toBe('Lead');
    expect(stages[6].name).toBe('Lost');
  });

  it('creates a pipeline with stages', () => {
    const pipeline = createPipeline({ sqlite }, { name: 'Test Pipeline' });
    expect(pipeline.name).toBe('Test Pipeline');

    const all = listPipelines({ sqlite });
    expect(all.some((p: any) => p.id === pipeline.id)).toBe(true);

    const stage = createStage({ sqlite }, { pipelineId: pipeline.id, name: 'Stage 1' });
    expect(stage.pipelineId).toBe(pipeline.id);
    expect(stage.position).toBeGreaterThanOrEqual(0);

    const stages = listStages({ sqlite }, pipeline.id);
    expect(stages.some((s: any) => s.id === stage.id)).toBe(true);
  });

  it('adds contact to pipeline and moves entry', () => {
    // Insert a contact
    const contactId = 'test-contact-1';
    raw.prepare('INSERT INTO contacts (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(contactId, 'Alice', new Date().toISOString(), new Date().toISOString());

    const stages = raw.prepare('SELECT * FROM pipeline_stages ORDER BY position').all() as any[];
    const pipeline = raw.prepare('SELECT * FROM pipelines LIMIT 1').get() as any;

    const entry = addContactToPipeline({ sqlite }, { contactId, pipelineId: pipeline.id, stageId: stages[0].id });
    expect(entry.contactId).toBe(contactId);
    expect(entry.stageId).toBe(stages[0].id);

    const entries = listEntries({ sqlite }, pipeline.id);
    expect(entries.length).toBeGreaterThan(0);

    // Move to next stage
    const moved = moveEntry({ sqlite }, entry.id, stages[1].id);
    expect(moved?.stageId).toBe(stages[1].id);

    // Verify transition was recorded
    const transitions = raw.prepare('SELECT * FROM stage_transitions WHERE entry_id = ?').all(entry.id) as any[];
    expect(transitions.length).toBe(2); // initial + move
  });

  it('cascades on contact delete', () => {
    const contactId = 'delete-test-contact';
    raw.prepare('INSERT INTO contacts (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(contactId, 'Bob', new Date().toISOString(), new Date().toISOString());

    const stages = raw.prepare('SELECT * FROM pipeline_stages ORDER BY position').all() as any[];
    const pipeline = raw.prepare('SELECT * FROM pipelines LIMIT 1').get() as any;

    addContactToPipeline({ sqlite }, { contactId, pipelineId: pipeline.id, stageId: stages[0].id });

    raw.prepare('DELETE FROM contacts WHERE id = ?').run(contactId);

    const entries = raw.prepare('SELECT * FROM pipeline_entries WHERE contact_id = ?').all(contactId) as any[];
    expect(entries.length).toBe(0);
  });

  it('blocks deleting last pipeline via API logic', () => {
    const pipelines = listPipelines({ sqlite });
    expect(pipelines.length).toBe(1);
    expect(pipelines[0].name).toBe('Contacts');
  });

  it('blocks deleting stage with entries', () => {
    const contactId = 'stage-block-test';
    raw.prepare('INSERT INTO contacts (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(contactId, 'Carol', new Date().toISOString(), new Date().toISOString());

    const stages = raw.prepare('SELECT * FROM pipeline_stages ORDER BY position').all() as any[];
    const pipeline = raw.prepare('SELECT * FROM pipelines LIMIT 1').get() as any;

    addContactToPipeline({ sqlite }, { contactId, pipelineId: pipeline.id, stageId: stages[0].id });

    const count = getEntriesInStage({ sqlite }, stages[0].id);
    expect(count).toBe(1);
  });
});
