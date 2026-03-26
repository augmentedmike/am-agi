import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';

// ── Schema mirrors reflection script + API ────────────────────────────────────

function createReflectionDb() {
  const db = new Database(':memory:');
  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'test',
      topic TEXT,
      term TEXT NOT NULL DEFAULT 'lt',
      created_at TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      content='memories',
      content_rowid='rowid'
    );
    CREATE TRIGGER IF NOT EXISTS mem_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content) VALUES (new.rowid, new.content);
    END;
    CREATE TABLE IF NOT EXISTS reflection_runs (
      id         TEXT PRIMARY KEY,
      run_at     TEXT NOT NULL,
      skipped    INTEGER NOT NULL DEFAULT 0,
      promoted   INTEGER NOT NULL DEFAULT 0,
      kept       INTEGER NOT NULL DEFAULT 0,
      dropped    INTEGER NOT NULL DEFAULT 0,
      log_path   TEXT,
      details    TEXT
    );
  `);
  return db;
}

type RunRow = {
  id: string;
  run_at: string;
  skipped: number;
  promoted: number;
  kept: number;
  dropped: number;
  log_path: string | null;
  details: string;
};

function insertRun(
  db: Database,
  id: string,
  opts: { promoted?: number; kept?: number; dropped?: number; skipped?: number; details?: string }
) {
  db.run(
    `INSERT INTO reflection_runs(id, run_at, skipped, promoted, kept, dropped, log_path, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      new Date().toISOString(),
      opts.skipped ?? 0,
      opts.promoted ?? 0,
      opts.kept ?? 0,
      opts.dropped ?? 0,
      null,
      opts.details ?? '[]',
    ]
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

let db: Database;

beforeEach(() => {
  db = createReflectionDb();
});

describe('reflection_runs table', () => {
  it('inserts a run record', () => {
    insertRun(db, 'run-1', { promoted: 2, kept: 1, dropped: 0 });
    const row = db.query('SELECT * FROM reflection_runs WHERE id = ?').get('run-1') as RunRow;
    expect(row).not.toBeNull();
    expect(row.promoted).toBe(2);
    expect(row.kept).toBe(1);
    expect(row.dropped).toBe(0);
  });

  it('stores and parses details JSON', () => {
    const details = JSON.stringify([
      { slug: 'localization', decision: 'promote', lt_id: 'abc-123' },
      { slug: 'old-rule', decision: 'drop' },
    ]);
    insertRun(db, 'run-2', { promoted: 1, dropped: 1, details });
    const row = db.query('SELECT details FROM reflection_runs WHERE id = ?').get('run-2') as { details: string };
    const parsed = JSON.parse(row.details);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].slug).toBe('localization');
    expect(parsed[0].decision).toBe('promote');
    expect(parsed[1].decision).toBe('drop');
  });

  it('returns runs ordered by run_at descending', () => {
    insertRun(db, 'old', { promoted: 1 });
    // Force a later timestamp
    db.run(
      `INSERT INTO reflection_runs(id, run_at, skipped, promoted, kept, dropped, log_path, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['new', new Date(Date.now() + 1000).toISOString(), 0, 3, 0, 0, null, '[]']
    );
    const rows = db.query<RunRow, []>(
      'SELECT * FROM reflection_runs ORDER BY run_at DESC'
    ).all();
    expect(rows[0].id).toBe('new');
    expect(rows[1].id).toBe('old');
  });

  it('aggregates stats across multiple runs', () => {
    insertRun(db, 'r1', { promoted: 2, kept: 1, dropped: 0 });
    insertRun(db, 'r2', { promoted: 0, kept: 3, dropped: 1 });
    insertRun(db, 'r3', { promoted: 5, kept: 0, dropped: 2 });
    const stats = db.query<{ total_promoted: number; total_dropped: number }, []>(
      'SELECT SUM(promoted) as total_promoted, SUM(dropped) as total_dropped FROM reflection_runs'
    ).get()!;
    expect(stats.total_promoted).toBe(7);
    expect(stats.total_dropped).toBe(3);
  });

  it('skipped count is stored correctly', () => {
    insertRun(db, 'skip-run', { skipped: 4, promoted: 0, kept: 0, dropped: 0 });
    const row = db.query('SELECT skipped FROM reflection_runs WHERE id = ?').get('skip-run') as { skipped: number };
    expect(row.skipped).toBe(4);
  });
});

describe('promoted memories appear in FTS search', () => {
  it('a memory promoted from ST is searchable in LT', () => {
    const id = 'promoted-1';
    db.run(
      `INSERT INTO memories(id, content, source, topic, term, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, 'never use useTranslations in client components', 'reflection', 'localization', 'lt', new Date().toISOString()]
    );
    const results = db.query<{ id: string }, [string]>(
      `SELECT m.id FROM memories_fts fts
       JOIN memories m ON m.rowid = fts.rowid
       WHERE memories_fts MATCH ?`
    ).all('useTranslations');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(id);
  });

  it('run record links to promoted memory via details', () => {
    const memId = 'mem-abc';
    db.run(
      `INSERT INTO memories(id, content, source, topic, term, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [memId, 'localization lesson', 'reflection', 'localization', 'lt', new Date().toISOString()]
    );
    const details = JSON.stringify([{ slug: 'localization', decision: 'promote', lt_id: memId }]);
    insertRun(db, 'run-with-link', { promoted: 1, details });

    const run = db.query('SELECT details FROM reflection_runs WHERE id = ?').get('run-with-link') as { details: string };
    const parsed = JSON.parse(run.details);
    expect(parsed[0].lt_id).toBe(memId);

    // Verify the linked memory exists
    const mem = db.query('SELECT content FROM memories WHERE id = ?').get(memId) as { content: string };
    expect(mem.content).toBe('localization lesson');
  });
});

describe('empty vault run', () => {
  it('records a run with all zeros when no ST memories exist', () => {
    insertRun(db, 'empty-run', { promoted: 0, kept: 0, dropped: 0, skipped: 0, details: '[]' });
    const row = db.query('SELECT * FROM reflection_runs WHERE id = ?').get('empty-run') as RunRow;
    expect(row.promoted).toBe(0);
    expect(row.kept).toBe(0);
    expect(row.dropped).toBe(0);
    expect(row.skipped).toBe(0);
    expect(JSON.parse(row.details)).toHaveLength(0);
  });
});
