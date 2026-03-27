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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reply_to_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      job_title TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'member',
      availability TEXT NOT NULL DEFAULT 'available',
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

  `);

  // Migrations for existing databases
  for (const col of [
    'ALTER TABLE cards ADD COLUMN in_progress_at TEXT',
    'ALTER TABLE cards ADD COLUMN in_review_at TEXT',
    'ALTER TABLE cards ADD COLUMN shipped_at TEXT',
    'ALTER TABLE cards ADD COLUMN project_id TEXT',
    "ALTER TABLE cards ADD COLUMN token_logs TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE cards ADD COLUMN parent_id TEXT",
    'ALTER TABLE projects ADD COLUMN versioned INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE projects ADD COLUMN prod_port INTEGER',
    'ALTER TABLE projects ADD COLUMN dev_port INTEGER',
    'ALTER TABLE projects ADD COLUMN demo_url TEXT',
    'ALTER TABLE cards ADD COLUMN version TEXT',
    'ALTER TABLE projects ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE projects ADD COLUMN github_repo TEXT',
    'ALTER TABLE projects ADD COLUMN vercel_url TEXT',
    'ALTER TABLE projects ADD COLUMN current_version TEXT',
    'ALTER TABLE cards ADD COLUMN pr_url TEXT',
  ]) {
    try { sqlite.exec(col); } catch { /* column already exists */ }
  }

  // Indexes (all idempotent)
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name ON projects(name)');
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email)');
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_iterations_card_iter ON iterations(card_id, iteration_number)');
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_cards_state_archived ON cards(state, archived)');
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_cards_project_id ON cards(project_id)');
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_cards_parent_id ON cards(parent_id)');
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_iterations_card_id ON iterations(card_id)');
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_chat_messages_status ON chat_messages(status)');
}
