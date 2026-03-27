import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

// DB_PATH must always be set in production via env. The cwd fallback is only
// for local `bun run dev` run from inside the board/ directory.
const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'board.db');

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
    if (DB_PATH !== ':memory:') registerShutdownHook(instance.sqlite);
  }
  return instance;
}

export function createTestDb() {
  return createDb(':memory:');
}
