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

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      title TEXT,
      notes TEXT,
      tags TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_memories (
      id TEXT PRIMARY KEY,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      content TEXT,
      memory_ref TEXT,
      memory_term TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS card_dependencies (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      depends_on_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE(card_id, depends_on_id)
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
    'ALTER TABLE projects ADD COLUMN template_type TEXT',
    "ALTER TABLE cards ADD COLUMN deps TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE cards ADD COLUMN card_type TEXT NOT NULL DEFAULT 'task'",
    "ALTER TABLE cards ADD COLUMN entity_fields TEXT NOT NULL DEFAULT '{}'",
    'ALTER TABLE chat_messages ADD COLUMN project_id TEXT',
    "ALTER TABLE chat_messages ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]'",
    'ALTER TABLE chat_messages ADD COLUMN input_tokens INTEGER',
    'ALTER TABLE chat_messages ADD COLUMN output_tokens INTEGER',
    // contacts extended fields
    'ALTER TABLE contacts ADD COLUMN notes TEXT',
    "ALTER TABLE contacts ADD COLUMN kind TEXT NOT NULL DEFAULT 'person'",
    'ALTER TABLE contacts ADD COLUMN role TEXT',
    'ALTER TABLE contacts ADD COLUMN source TEXT',
    "ALTER TABLE contacts ADD COLUMN linked_memory_ids TEXT NOT NULL DEFAULT '[]'",
    // contact_memories ref columns
    'ALTER TABLE contact_memories ADD COLUMN memory_ref TEXT',
    'ALTER TABLE contact_memories ADD COLUMN memory_term TEXT',
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
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name)');
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_contact_memories_contact_id ON contact_memories(contact_id)');
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_memories_contact_ref ON contact_memories(contact_id, memory_ref) WHERE memory_ref IS NOT NULL');
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_card_dependencies_card_id ON card_dependencies(card_id)');
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_card_dependencies_depends_on_id ON card_dependencies(depends_on_id)');
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS card_contacts (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      contact_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE(card_id, contact_card_id)
    )
  `);
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_card_contacts_card_id ON card_contacts(card_id)');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS contact_emails (
      id          TEXT PRIMARY KEY,
      contact_id  TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      direction   TEXT NOT NULL DEFAULT 'sent',
      subject     TEXT NOT NULL,
      body        TEXT NOT NULL,
      from_addr   TEXT NOT NULL,
      to_addr     TEXT NOT NULL,
      sent_at     TEXT NOT NULL,
      error       TEXT
    )
  `);
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_contact_emails_contact_id ON contact_emails(contact_id)');

  // Email sync tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS email_syncs (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      account_email TEXT NOT NULL,
      last_sync_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'idle',
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL UNIQUE,
      sync_id TEXT NOT NULL REFERENCES email_syncs(id),
      contact_id TEXT REFERENCES contacts(id),
      thread_id TEXT,
      subject TEXT,
      from_address TEXT NOT NULL,
      to_addresses TEXT NOT NULL DEFAULT '[]',
      cc_addresses TEXT NOT NULL DEFAULT '[]',
      snippet TEXT,
      body_text TEXT,
      labels TEXT NOT NULL DEFAULT '[]',
      is_read INTEGER NOT NULL DEFAULT 0,
      is_starred INTEGER NOT NULL DEFAULT 0,
      received_at TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS email_attachments (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      provider_attachment_id TEXT,
      created_at TEXT NOT NULL
    )
  `);

  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_emails_contact_id ON emails(contact_id)');
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_emails_sync_id ON emails(sync_id)');
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_provider_id ON emails(provider_id)');
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON email_attachments(email_id)');

  // Backfill: set current_version = '0.0.1' for versioned projects that have none
  sqlite.exec(`
    UPDATE projects
    SET current_version = '0.0.1', updated_at = datetime('now')
    WHERE versioned = 1 AND (current_version IS NULL OR current_version = '')
  `);

  // Backfill: stamp version = current_version on cards that belong to versioned projects with a current_version
  sqlite.exec(`
    UPDATE cards
    SET version = (SELECT p.current_version FROM projects p WHERE p.id = cards.project_id AND p.versioned = 1 AND p.current_version IS NOT NULL),
        updated_at = datetime('now')
    WHERE (version IS NULL OR version = '')
      AND project_id IN (SELECT id FROM projects WHERE versioned = 1 AND current_version IS NOT NULL)
  `);

  // Set AM Board root project as Software Development / next-app, versioned at 0.0.1
  sqlite.exec(`
    UPDATE projects
    SET template_type = 'next-app',
        versioned = 1,
        current_version = '0.0.1',
        updated_at = datetime('now')
    WHERE id = 'am-board-0000-0000-0000-000000000000'
      AND (template_type IS NULL OR template_type = '' OR template_type = 'next-app')
  `);

  // Seed: register helloam-www as a Software Development (NextJS) project
  sqlite.exec(`
    INSERT OR IGNORE INTO projects (id, name, repo_dir, versioned, is_test, template_type, created_at, updated_at)
    VALUES (
      'helloam-www-project',
      'helloam-www',
      '~/am/workspaces/helloam-www',
      1,
      0,
      'next-app',
      datetime('now'),
      datetime('now')
    )
  `);

}
