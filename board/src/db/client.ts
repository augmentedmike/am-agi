import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import { runMigrations } from './migrations';

// DB_PATH env var is always set in production (launchd plist) and canary (board-deploy).
// Fallback: walk up from __dirname to find the board/ root (works for `bun run dev`).
function defaultDbPath(): string {
  // __dirname in compiled Next.js is inside .next/server/chunks/ — walk up to find board.db
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'board.db');
    // Stop when we find an existing db or when we're at a directory named 'board'
    if (path.basename(dir) === 'board' || require('fs').existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  // Last resort: cwd (only correct when cwd = board/)
  return path.join(process.cwd(), 'board.db');
}
const DB_PATH = process.env.DB_PATH ?? defaultDbPath();

function createDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');   // wait up to 5s on lock contention instead of immediate SQLITE_BUSY
  sqlite.pragma('synchronous = FULL');    // guarantees WAL durability on process exit
  sqlite.pragma('cache_size = -64000');   // 64MB page cache

  // Try to load sqlite-vec extension
  try {
    const sqliteVec = require('sqlite-vec');
    sqliteVec.load(sqlite);
  } catch {
    // Vector extension unavailable — vector search will use JS fallback
  }

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

let instance: ReturnType<typeof createDb> | null = null;

/** Flush WAL to main DB file and close connection cleanly on process exit. */
function registerShutdownHook(sqlite: import('better-sqlite3').Database) {
  const flush = () => {
    try { sqlite.pragma('wal_checkpoint(FULL)'); } catch {}
    try { sqlite.close(); } catch {}
  };
  process.once('SIGTERM', () => { flush(); process.exit(0); });
  process.once('SIGINT',  () => { flush(); process.exit(0); });
  process.once('beforeExit', flush);
}

export function getDb() {
  if (!instance) {
    instance = createDb(DB_PATH);
    runMigrations(instance.db, instance.sqlite);
    if (DB_PATH !== ':memory:') registerShutdownHook(instance.sqlite);
  }
  return instance;
}

export function createTestDb() {
  const inst = createDb(':memory:');
  runMigrations(inst.db, inst.sqlite);
  return inst;
}
