import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Paths match the memory CLI
const AM_ROOT = path.resolve(process.cwd(), '..');
const ST_DIR = path.join(AM_ROOT, 'workspaces/memory/st');
const LT_DB_PATH = path.join(AM_ROOT, 'workspaces/memory/lt/memory.db');

function ensureDirs() {
  fs.mkdirSync(ST_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(LT_DB_PATH), { recursive: true });
}

function getLtDb() {
  const db = new Database(LT_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'api',
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
    CREATE TRIGGER IF NOT EXISTS mem_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content) VALUES('delete', old.rowid, old.content);
    END;
    CREATE TRIGGER IF NOT EXISTS mem_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content) VALUES('delete', old.rowid, old.content);
      INSERT INTO memories_fts(rowid, content) VALUES(new.rowid, new.content);
    END;
  `);
  return db;
}

function readStMemories(): Array<{ slug: string; content: string }> {
  if (!fs.existsSync(ST_DIR)) return [];
  return fs.readdirSync(ST_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      slug: f.replace(/\.md$/, ''),
      content: fs.readFileSync(path.join(ST_DIR, f), 'utf8'),
    }));
}

// GET /api/memory?q=query&limit=8  — recall (ST all + LT search)
// GET /api/memory?list=1            — list all
export async function GET(req: NextRequest) {
  ensureDirs();
  const { searchParams } = req.nextUrl;
  const query = searchParams.get('q');
  const listAll = searchParams.get('list') === '1';
  const limit = parseInt(searchParams.get('limit') ?? '8', 10);

  const st = readStMemories();

  if (listAll) {
    const db = getLtDb();
    const lt = db.prepare('SELECT id, topic, term, content, created_at FROM memories ORDER BY created_at DESC').all() as Array<{
      id: string; topic: string | null; term: string; content: string; created_at: string;
    }>;
    db.close();
    return NextResponse.json({ st, lt });
  }

  // Recall: ST always + LT search
  let lt: Array<{ id: string; topic: string | null; content: string; created_at: string }> = [];
  if (query) {
    const db = getLtDb();
    try {
      const escaped = query.replace(/['"]/g, ' ');
      lt = db.prepare(`
        SELECT m.id, m.topic, m.content, m.created_at
        FROM memories_fts fts
        JOIN memories m ON m.rowid = fts.rowid
        WHERE memories_fts MATCH ?
        ORDER BY rank LIMIT ?
      `).all(escaped, limit) as typeof lt;
    } catch {
      // FTS fallback
      lt = db.prepare(`
        SELECT id, topic, content, created_at FROM memories
        WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?
      `).all(`%${query.slice(0, 60)}%`, limit) as typeof lt;
    }
    db.close();
  }

  return NextResponse.json({ st, lt, query });
}

// POST /api/memory  { content, term?: 'st'|'lt'|'auto', topic? }
export async function POST(req: NextRequest) {
  ensureDirs();
  const body = await req.json() as { content: string; term?: string; topic?: string };
  const { content, topic } = body;
  let term = body.term ?? 'auto';

  if (!content?.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }

  // Auto-route heuristic
  if (term === 'auto') {
    const isShort = content.length < 400;
    const isRule = /always|never|don.t|do not|must|should not|stop|avoid|prefer|only use|never use/i.test(content);
    term = (isShort && isRule) ? 'st' : 'lt';
  }

  if (term === 'st') {
    const slug = topic ?? content.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/-+$/, '');
    const file = path.join(ST_DIR, `${slug}.md`);
    const now = new Date().toISOString();
    if (fs.existsSync(file)) {
      fs.appendFileSync(file, `\n---\n<!-- added: ${now} -->\n${content}\n`);
    } else {
      fs.writeFileSync(file, `<!-- created: ${now} -->\n# ${slug}\n\n${content}\n`);
    }
    return NextResponse.json({ term: 'st', slug, file });
  } else {
    const db = getLtDb();
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO memories(id,content,source,topic,term,created_at) VALUES(?,?,?,?,?,?)')
      .run(id, content, 'api', topic ?? null, 'lt', now);
    db.close();
    return NextResponse.json({ term: 'lt', id });
  }
}

// DELETE /api/memory?id=<id-or-slug>
export async function DELETE(req: NextRequest) {
  ensureDirs();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const stFile = path.join(ST_DIR, `${id}.md`);
  if (fs.existsSync(stFile)) {
    fs.unlinkSync(stFile);
    return NextResponse.json({ deleted: 'st', slug: id });
  }

  const db = getLtDb();
  const result = db.prepare("DELETE FROM memories WHERE id=? OR topic=?").run(id, id);
  db.close();
  if (result.changes === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ deleted: 'lt', id, count: result.changes });
}
