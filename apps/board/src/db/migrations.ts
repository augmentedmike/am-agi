import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export function runMigrations(db: BetterSQLite3Database<typeof schema>, sqlite: import('better-sqlite3').Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'normal',
      attachments TEXT NOT NULL DEFAULT '[]',
      work_log TEXT NOT NULL DEFAULT '[]',
      work_dir TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS iterations (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id),
      iteration_number INTEGER NOT NULL,
      log_text TEXT NOT NULL,
      commit_sha TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      embedding BLOB,
      source TEXT NOT NULL,
      card_id TEXT,
      created_at TEXT NOT NULL
    );

  `);

  // Add archived column if it doesn't exist yet
  const cols = sqlite.prepare("PRAGMA table_info(cards)").all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === 'archived')) {
    sqlite.exec("ALTER TABLE cards ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  }
}
