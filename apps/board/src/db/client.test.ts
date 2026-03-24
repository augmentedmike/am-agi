// Test-only client using bun:sqlite (better-sqlite3 is unsupported in bun test runner)
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  // Wrap sqlite to expose exec() for migrations
  const sqliteCompat = {
    exec: (sql: string) => sqlite.run(sql),
  } as unknown as import('better-sqlite3').Database;
  return { db: db as unknown as import('drizzle-orm/better-sqlite3').BetterSQLite3Database<typeof schema>, sqlite: sqliteCompat };
}
