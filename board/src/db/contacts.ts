import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { Contact, ContactMemory } from './schema';

type Db = { sqlite: InstanceType<typeof Database> };

// ── helpers ──────────────────────────────────────────────────────────────────

function rowToContact(row: Record<string, unknown>): Contact {
  return {
    id: row.id as string,
    name: row.name as string,
    email: (row.email ?? null) as string | null,
    phone: (row.phone ?? null) as string | null,
    company: (row.company ?? null) as string | null,
    title: (row.title ?? null) as string | null,
    tags: (row.tags ?? null) as string | null,
    avatarUrl: (row.avatar_url ?? null) as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToMemory(row: Record<string, unknown>): ContactMemory {
  return {
    id: row.id as string,
    contactId: row.contact_id as string,
    content: row.content as string,
    createdAt: row.created_at as string,
  };
}

// ── contacts ─────────────────────────────────────────────────────────────────

export function listContacts({ sqlite }: Db): Contact[] {
  const rows = sqlite.prepare('SELECT * FROM contacts ORDER BY name ASC').all() as Record<string, unknown>[];
  return rows.map(rowToContact);
}

export function searchContacts({ sqlite }: Db, q: string): Contact[] {
  const like = `%${q}%`;
  const rows = sqlite.prepare(
    'SELECT * FROM contacts WHERE name LIKE ? OR email LIKE ? OR company LIKE ? ORDER BY name ASC'
  ).all(like, like, like) as Record<string, unknown>[];
  return rows.map(rowToContact);
}

export function getContact({ sqlite }: Db, id: string): Contact | undefined {
  const row = sqlite.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToContact(row) : undefined;
}

export type CreateContactInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  tags?: string | null;
  avatarUrl?: string | null;
};

export function createContact({ sqlite }: Db, input: CreateContactInput): Contact {
  const id = randomUUID();
  const now = new Date().toISOString();
  sqlite.prepare(
    `INSERT INTO contacts (id, name, email, phone, company, title, tags, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name,
    input.email ?? null,
    input.phone ?? null,
    input.company ?? null,
    input.title ?? null,
    input.tags ?? null,
    input.avatarUrl ?? null,
    now,
    now
  );
  return getContact({ sqlite }, id)!;
}

export type UpdateContactInput = Partial<Omit<CreateContactInput, 'name'> & { name: string }>;

export function updateContact({ sqlite }: Db, id: string, input: UpdateContactInput): Contact | undefined {
  const existing = getContact({ sqlite }, id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if ('email' in input) { fields.push('email = ?'); values.push(input.email ?? null); }
  if ('phone' in input) { fields.push('phone = ?'); values.push(input.phone ?? null); }
  if ('company' in input) { fields.push('company = ?'); values.push(input.company ?? null); }
  if ('title' in input) { fields.push('title = ?'); values.push(input.title ?? null); }
  if ('tags' in input) { fields.push('tags = ?'); values.push(input.tags ?? null); }
  if ('avatarUrl' in input) { fields.push('avatar_url = ?'); values.push(input.avatarUrl ?? null); }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  sqlite.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getContact({ sqlite }, id);
}

export function deleteContact({ sqlite }: Db, id: string): void {
  sqlite.prepare('DELETE FROM contact_memories WHERE contact_id = ?').run(id);
  sqlite.prepare('DELETE FROM contacts WHERE id = ?').run(id);
}

// ── memories ─────────────────────────────────────────────────────────────────

export function listMemories({ sqlite }: Db, contactId: string): ContactMemory[] {
  const rows = sqlite.prepare(
    'SELECT * FROM contact_memories WHERE contact_id = ? ORDER BY created_at ASC'
  ).all(contactId) as Record<string, unknown>[];
  return rows.map(rowToMemory);
}

export function createMemory({ sqlite }: Db, contactId: string, content: string): ContactMemory {
  const id = randomUUID();
  const now = new Date().toISOString();
  sqlite.prepare(
    'INSERT INTO contact_memories (id, contact_id, content, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, contactId, content, now);
  const row = sqlite.prepare('SELECT * FROM contact_memories WHERE id = ?').get(id) as Record<string, unknown>;
  return rowToMemory(row);
}

export function deleteMemory({ sqlite }: Db, memId: string): void {
  sqlite.prepare('DELETE FROM contact_memories WHERE id = ?').run(memId);
}
