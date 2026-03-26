import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ── Helpers mirroring the memory API logic ────────────────────────────────────

function createMemoryDb() {
  const sqlite = new Database(':memory:');
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id    TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      source  TEXT NOT NULL DEFAULT 'test',
      topic   TEXT,
      term    TEXT NOT NULL DEFAULT 'lt',
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
    CREATE TRIGGER IF NOT EXISTS mem_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content) VALUES('delete', old.rowid, old.content);
    END;
    CREATE TRIGGER IF NOT EXISTS mem_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content) VALUES('delete', old.rowid, old.content);
      INSERT INTO memories_fts(rowid, content) VALUES(new.rowid, new.content);
    END;
  `);
  return sqlite;
}

function insertMemory(db: Database, id: string, content: string, topic?: string) {
  db.run(
    'INSERT INTO memories(id, content, source, topic, term, created_at) VALUES(?,?,?,?,?,?)',
    [id, content, 'test', topic ?? null, 'lt', new Date().toISOString()]
  );
}

function ftsSearch(db: Database, query: string, limit = 8): Array<{ id: string; content: string }> {
  try {
    return db.query<{ id: string; content: string }, [string, number]>(
      `SELECT m.id, m.content
       FROM memories_fts fts
       JOIN memories m ON m.rowid = fts.rowid
       WHERE memories_fts MATCH ?
       ORDER BY rank LIMIT ?`
    ).all(query, limit);
  } catch {
    return [];
  }
}

// Auto-route heuristic — mirrors the API
function autoRoute(content: string): 'st' | 'lt' {
  const isShort = content.length < 400;
  const isRule = /always|never|don.t|do not|must|should not|stop|avoid|prefer|only use|never use/i.test(content);
  return isShort && isRule ? 'st' : 'lt';
}

// ── ST file helpers ───────────────────────────────────────────────────────────

function makeTmpStDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'am-memory-test-'));
}

function writeStFile(dir: string, slug: string, content: string) {
  fs.writeFileSync(path.join(dir, `${slug}.md`), content, 'utf8');
}

function readStFiles(dir: string): string[] {
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

let db: Database;
let stDir: string;

beforeEach(() => {
  db = createMemoryDb();
  stDir = makeTmpStDir();
});

describe('LT memory — insert and retrieve', () => {
  it('stores a memory and retrieves it by id', () => {
    insertMemory(db, 'id-1', 'localization rules for the board app');
    const row = db.query('SELECT * FROM memories WHERE id = ?').get('id-1') as { content: string } | null;
    expect(row).not.toBeNull();
    expect(row!.content).toBe('localization rules for the board app');
  });

  it('stores multiple memories', () => {
    insertMemory(db, 'a', 'first memory');
    insertMemory(db, 'b', 'second memory');
    const rows = db.query('SELECT COUNT(*) as n FROM memories').get() as { n: number };
    expect(rows.n).toBe(2);
  });

  it('stores topic and retrieves it', () => {
    insertMemory(db, 'x', 'content here', 'localization');
    const row = db.query('SELECT topic FROM memories WHERE id = ?').get('x') as { topic: string };
    expect(row.topic).toBe('localization');
  });
});

describe('LT memory — FTS5 search', () => {
  it('finds a memory by keyword', () => {
    insertMemory(db, '1', 'never use useTranslations from next-intl in client components');
    insertMemory(db, '2', 'always run npm run build before shipping');
    const results = ftsSearch(db, 'useTranslations');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('1');
  });

  it('returns top result ranked by relevance', () => {
    insertMemory(db, 'a', 'localization setup for the board');
    insertMemory(db, 'b', 'localization localization localization — very relevant');
    insertMemory(db, 'c', 'database migrations guide');
    const results = ftsSearch(db, 'localization');
    expect(results.length).toBe(2);
    expect(results[0].id).toBe('b'); // higher frequency = better rank
  });

  it('returns empty array when nothing matches', () => {
    insertMemory(db, '1', 'something about agents');
    const results = ftsSearch(db, 'xyzzy_no_match');
    expect(results.length).toBe(0);
  });

  it('respects limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      insertMemory(db, `id-${i}`, `agent memory entry number ${i}`);
    }
    const results = ftsSearch(db, 'agent', 3);
    expect(results.length).toBe(3);
  });
});

describe('LT memory — delete', () => {
  it('deletes by id', () => {
    insertMemory(db, 'del-1', 'to be removed');
    db.run("DELETE FROM memories WHERE id = 'del-1'");
    const row = db.query("SELECT * FROM memories WHERE id = 'del-1'").get();
    expect(row).toBeNull();
  });

  it('FTS index is updated after delete — deleted entry not returned in search', () => {
    insertMemory(db, 'keep', 'localization rules to keep');
    insertMemory(db, 'drop', 'localization rules to drop');
    db.run("DELETE FROM memories WHERE id = 'drop'");
    const results = ftsSearch(db, 'localization');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('keep');
  });
});

describe('auto-route heuristic', () => {
  it('routes short imperative rule to ST', () => {
    expect(autoRoute('Never use useTranslations() from next-intl')).toBe('st');
  });

  it('routes "always" rule to ST', () => {
    expect(autoRoute('Always run npm run build before considering work done')).toBe('st');
  });

  it('routes long content to LT regardless of tone', () => {
    const long = 'never '.repeat(100); // >400 chars, but too long for ST
    expect(autoRoute(long)).toBe('lt');
  });

  it('routes neutral short content to LT', () => {
    expect(autoRoute('The board uses SQLite with Drizzle ORM.')).toBe('lt');
  });

  it('routes "do not" rule to ST', () => {
    expect(autoRoute('Do not add files to apps/board/ — that path does not exist')).toBe('st');
  });

  it('routes "prefer" rule to ST', () => {
    expect(autoRoute('Prefer bun over npm for JS execution')).toBe('st');
  });
});

describe('ST file operations', () => {
  it('creates a new ST file', () => {
    writeStFile(stDir, 'localization', '# localization\n\nNever use next-intl in client components.');
    expect(readStFiles(stDir)).toContain('localization');
  });

  it('reads ST file content', () => {
    writeStFile(stDir, 'testing', '# testing\n\nAlways add tests when something fails.');
    const content = fs.readFileSync(path.join(stDir, 'testing.md'), 'utf8');
    expect(content).toContain('Always add tests');
  });

  it('lists multiple ST files', () => {
    writeStFile(stDir, 'rule-a', 'content a');
    writeStFile(stDir, 'rule-b', 'content b');
    writeStFile(stDir, 'rule-c', 'content c');
    expect(readStFiles(stDir).sort()).toEqual(['rule-a', 'rule-b', 'rule-c']);
  });

  it('deletes a ST file', () => {
    writeStFile(stDir, 'to-delete', 'temporary rule');
    fs.unlinkSync(path.join(stDir, 'to-delete.md'));
    expect(readStFiles(stDir)).not.toContain('to-delete');
  });

  it('empty directory returns no slugs', () => {
    expect(readStFiles(stDir)).toHaveLength(0);
  });
});
