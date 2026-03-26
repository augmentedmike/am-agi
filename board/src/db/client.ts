import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'board.db');

function createDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');   // wait up to 5s on lock contention instead of immediate SQLITE_BUSY
  sqlite.pragma('synchronous = NORMAL');  // safe with WAL, faster than FULL
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

export function getDb() {
  if (!instance) {
    instance = createDb(DB_PATH);
  }
  return instance;
}

export function createTestDb() {
  return createDb(':memory:');
}
