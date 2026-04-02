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
    // project default publish branch
    'ALTER TABLE projects ADD COLUMN default_branch TEXT',
    // calendar scheduling
    'ALTER TABLE cards ADD COLUMN scheduled_at TEXT',
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

  // Automation rules
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS automation_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      project_id TEXT,
      trigger_type TEXT NOT NULL,
      trigger_conditions TEXT NOT NULL DEFAULT '{}',
      action_type TEXT NOT NULL,
      action_params TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_automation_rules_project_id ON automation_rules(project_id)');

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

  // Seed AM Board root project if missing, then update its fields
  sqlite.exec(`
    INSERT OR IGNORE INTO projects (id, name, repo_dir, versioned, is_test, template_type, github_repo, current_version, created_at, updated_at)
    VALUES (
      'am-board-0000-0000-0000-000000000000',
      'AM Board',
      '~/am',
      1,
      0,
      'next-app',
      'augmentedmike/am-agi',
      '0.0.1',
      datetime('now'),
      datetime('now')
    )
  `);
  sqlite.exec(`
    UPDATE projects
    SET template_type = 'next-app',
        versioned = 1,
        repo_dir = CASE WHEN repo_dir IS NULL OR repo_dir = '' THEN '~/am' ELSE repo_dir END,
        github_repo = CASE WHEN github_repo IS NULL OR github_repo = '' THEN 'augmentedmike/am-agi' ELSE github_repo END,
        current_version = CASE WHEN current_version IS NULL OR current_version = '' THEN '0.0.1' ELSE current_version END,
        updated_at = datetime('now')
    WHERE id = 'am-board-0000-0000-0000-000000000000'
      AND (template_type IS NULL OR template_type = '' OR template_type = 'next-app')
  `);

  // Knowledge graph tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      summary TEXT,
      properties TEXT NOT NULL DEFAULT '{}',
      confidence INTEGER NOT NULL DEFAULT 100,
      source TEXT,
      embedding BLOB,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS relations (
      id TEXT PRIMARY KEY,
      from_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      to_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      relation TEXT NOT NULL,
      weight INTEGER NOT NULL DEFAULT 1,
      properties TEXT NOT NULL DEFAULT '{}',
      source TEXT,
      created_at TEXT NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
      id UNINDEXED,
      name,
      aliases,
      summary,
      content=entities,
      content_rowid=rowid
    )
  `);

  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type)');
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name)');
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_id)');
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_id)');

  // FTS triggers to keep entities_fts in sync
  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
      INSERT INTO entities_fts(rowid, id, name, aliases, summary)
      VALUES (new.rowid, new.id, new.name, new.aliases, new.summary);
    END
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
      INSERT INTO entities_fts(entities_fts, rowid, id, name, aliases, summary)
      VALUES ('delete', old.rowid, old.id, old.name, old.aliases, old.summary);
    END
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
      INSERT INTO entities_fts(entities_fts, rowid, id, name, aliases, summary)
      VALUES ('delete', old.rowid, old.id, old.name, old.aliases, old.summary);
      INSERT INTO entities_fts(rowid, id, name, aliases, summary)
      VALUES (new.rowid, new.id, new.name, new.aliases, new.summary);
    END
  `);

}
