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
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      in_progress_at TEXT,
      in_review_at TEXT,
      shipped_at TEXT
    );

    CREATE TABLE IF NOT EXISTS iterations (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id),
      iteration_number INTEGER NOT NULL,
      log_text TEXT NOT NULL,
      commit_sha TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      repo_dir TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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

  // Migrations for existing databases
  for (const col of [
    'ALTER TABLE cards ADD COLUMN in_progress_at TEXT',
    'ALTER TABLE cards ADD COLUMN in_review_at TEXT',
    'ALTER TABLE cards ADD COLUMN shipped_at TEXT',
    'ALTER TABLE cards ADD COLUMN project_id TEXT',
    "ALTER TABLE cards ADD COLUMN token_logs TEXT NOT NULL DEFAULT '[]'",
  ]) {
    try { sqlite.exec(col); } catch { /* column already exists */ }
  }
}
