// Test-only client using bun:sqlite (better-sqlite3 is unsupported in bun test runner)
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  // Wrap sqlite to expose exec() and prepare() for migrations
  const sqliteCompat = {
    exec: (sql: string) => sqlite.run(sql),
    prepare: (sql: string) => {
      const stmt = sqlite.prepare(sql);
      return {
        get: (...params: unknown[]) => stmt.get(...params),
        run: (...params: unknown[]) => stmt.run(...params),
        all: (...params: unknown[]) => stmt.all(...params),
      };
    },
  } as unknown as import('better-sqlite3').Database;
  // Expose sqlite compat on db so raw-sqlite functions (contacts.ts etc.) work when called as fn(db, ...)
  const dbWithSqlite = Object.assign(db, { sqlite: sqliteCompat });
  type DbWithSqlite = import('drizzle-orm/better-sqlite3').BetterSQLite3Database<typeof schema> & { sqlite: import('better-sqlite3').Database };
  return { db: dbWithSqlite as unknown as DbWithSqlite, sqlite: sqliteCompat };
}
