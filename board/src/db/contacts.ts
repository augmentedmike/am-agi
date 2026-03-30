import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { Contact, ContactMemory, ContactEmail } from './schema';

// Accept either { sqlite } (raw better-sqlite3 / wrapper) or a drizzle db object (session.client)
type DbArg = { sqlite: unknown } | Record<string, unknown> | unknown;

function toSqlite(db: DbArg): InstanceType<typeof Database> {
  const d = db as Record<string, unknown>;
  if (d && 'sqlite' in d && d.sqlite) {
    return d.sqlite as InstanceType<typeof Database>;
  }
  // drizzle-orm BetterSQLite3Database / BunSQLiteDatabase: session.client is the raw db
  const session = d?.session as Record<string, unknown> | undefined;
  if (session?.client) {
    return session.client as InstanceType<typeof Database>;
  }
  throw new Error('Cannot resolve sqlite from db argument');
}

// ── helpers ──────────────────────────────────────────────────────────────────

function rowToContact(row: Record<string, unknown>): Contact {
  let tags: string[] = [];
  try {
    const raw = row.tags;
    if (raw) tags = JSON.parse(raw as string);
  } catch { tags = []; }

  return {
    id: row.id as string,
    name: row.name as string,
    email: (row.email ?? null) as string | null,
    phone: (row.phone ?? null) as string | null,
    company: (row.company ?? null) as string | null,
    title: (row.title ?? null) as string | null,
    notes: (row.notes ?? null) as string | null,
    tags,
    avatarUrl: (row.avatar_url ?? null) as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToMemory(row: Record<string, unknown>): ContactMemory {
  return {
    id: row.id as string,
    contactId: row.contact_id as string,
    content: (row.content ?? '') as string,
    memoryRef: (row.memory_ref ?? null) as string | null,
    memoryTerm: (row.memory_term ?? null) as string | null,
    createdAt: row.created_at as string,
  };
}

function rowToContactMemory(row: Record<string, unknown>): ContactMemoryRef {
  return {
    id: row.id as string,
    contactId: row.contact_id as string,
    memoryRef: row.memory_ref as string,
    memoryTerm: row.memory_term as string,
    createdAt: row.created_at as string,
  };
}

// ── contacts ─────────────────────────────────────────────────────────────────

export function listContacts(db: DbArg): Contact[] {
  const sqlite = toSqlite(db);
  const rows = sqlite.prepare('SELECT * FROM contacts ORDER BY name ASC').all() as Record<string, unknown>[];
  return rows.map(rowToContact);
}

export function searchContacts(db: DbArg, q: string): Contact[] {
  const sqlite = toSqlite(db);
  const like = `%${q}%`;
  const rows = sqlite.prepare(
    'SELECT * FROM contacts WHERE name LIKE ? OR email LIKE ? OR company LIKE ? ORDER BY name ASC'
  ).all(like, like, like) as Record<string, unknown>[];
  return rows.map(rowToContact);
}

export function getContact(db: DbArg, id: string): Contact | undefined {
  const sqlite = toSqlite(db);
  const row = sqlite.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToContact(row) : undefined;
}

export type CreateContactInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  avatarUrl?: string | null;
};

export function createContact(db: DbArg, input: CreateContactInput): Contact {
  const sqlite = toSqlite(db);
  const id = randomUUID();
  const now = new Date().toISOString();
  const tags = JSON.stringify(input.tags ?? []);
  sqlite.prepare(
    `INSERT INTO contacts (id, name, email, phone, company, title, notes, tags, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name,
    input.email ?? null,
    input.phone ?? null,
    input.company ?? null,
    input.title ?? null,
    input.notes ?? null,
    tags,
    input.avatarUrl ?? null,
    now,
    now
  );
  return getContact(db, id)!;
}

export type UpdateContactInput = Partial<Omit<CreateContactInput, 'name'> & { name: string }>;

export function updateContact(db: DbArg, id: string, input: UpdateContactInput): Contact | null {
  const sqlite = toSqlite(db);
  const existing = getContact(db, id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if ('email' in input) { fields.push('email = ?'); values.push(input.email ?? null); }
  if ('phone' in input) { fields.push('phone = ?'); values.push(input.phone ?? null); }
  if ('company' in input) { fields.push('company = ?'); values.push(input.company ?? null); }
  if ('title' in input) { fields.push('title = ?'); values.push(input.title ?? null); }
  if ('notes' in input) { fields.push('notes = ?'); values.push(input.notes ?? null); }
  if ('tags' in input) { fields.push('tags = ?'); values.push(JSON.stringify(input.tags ?? [])); }
  if ('avatarUrl' in input) { fields.push('avatar_url = ?'); values.push(input.avatarUrl ?? null); }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  sqlite.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getContact(db, id) ?? null;
}

export function deleteContact(db: DbArg, id: string): void {
  const sqlite = toSqlite(db);
  sqlite.prepare('DELETE FROM contact_memories WHERE contact_id = ?').run(id);
  sqlite.prepare('DELETE FROM contacts WHERE id = ?').run(id);
}

// ── memories (legacy content-based API) ──────────────────────────────────────

export function listMemories(db: DbArg, contactId: string): ContactMemory[] {
  const sqlite = toSqlite(db);
  const rows = sqlite.prepare(
    'SELECT * FROM contact_memories WHERE contact_id = ? ORDER BY created_at ASC'
  ).all(contactId) as Record<string, unknown>[];
  return rows.map(rowToMemory);
}

export function createMemory(db: DbArg, contactId: string, content: string): ContactMemory {
  const sqlite = toSqlite(db);
  const id = randomUUID();
  const now = new Date().toISOString();
  sqlite.prepare(
    'INSERT INTO contact_memories (id, contact_id, content, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, contactId, content, now);
  const row = sqlite.prepare('SELECT * FROM contact_memories WHERE id = ?').get(id) as Record<string, unknown>;
  return rowToMemory(row);
}

export function deleteMemory(db: DbArg, memId: string): void {
  const sqlite = toSqlite(db);
  sqlite.prepare('DELETE FROM contact_memories WHERE id = ?').run(memId);
}

// ── contact memory refs (new memory-link API) ─────────────────────────────────

export type ContactMemoryRef = {
  id: string;
  contactId: string;
  memoryRef: string;
  memoryTerm: string;
  createdAt: string;
};

export type AddContactMemoryInput = {
  memoryRef: string;
  memoryTerm: string;
};

export function listContactMemories(db: DbArg, contactId: string): ContactMemoryRef[] {
  const sqlite = toSqlite(db);
  const rows = sqlite.prepare(
    `SELECT * FROM contact_memories
     WHERE contact_id = ? AND memory_ref IS NOT NULL
     ORDER BY created_at ASC`
  ).all(contactId) as Record<string, unknown>[];
  return rows.map(rowToContactMemory);
}

export function addContactMemory(db: DbArg, contactId: string, input: AddContactMemoryInput): ContactMemoryRef {
  const sqlite = toSqlite(db);
  const id = randomUUID();
  const now = new Date().toISOString();
  // content column has NOT NULL constraint — use empty string for ref rows
  sqlite.prepare(
    `INSERT INTO contact_memories (id, contact_id, content, memory_ref, memory_term, created_at)
     VALUES (?, ?, '', ?, ?, ?)`
  ).run(id, contactId, input.memoryRef, input.memoryTerm, now);
  const row = sqlite.prepare('SELECT * FROM contact_memories WHERE id = ?').get(id) as Record<string, unknown>;
  return rowToContactMemory(row);
}

export function removeContactMemory(db: DbArg, contactId: string, memoryRef: string): void {
  const sqlite = toSqlite(db);
  sqlite.prepare(
    'DELETE FROM contact_memories WHERE contact_id = ? AND memory_ref = ?'
  ).run(contactId, memoryRef);
}

export function listContactEmails(db: DbArg, contactId: string): ContactEmail[] {
  const sqlite = toSqlite(db);
  const rows = sqlite.prepare(
    'SELECT * FROM contact_emails WHERE contact_id = ? ORDER BY sent_at ASC'
  ).all(contactId) as Record<string, unknown>[];
  return rows.map(r => ({
    id: r.id as string,
    contactId: r.contact_id as string,
    direction: r.direction as 'sent' | 'received',
    subject: r.subject as string,
    body: r.body as string,
    fromAddr: r.from_addr as string,
    toAddr: r.to_addr as string,
    sentAt: r.sent_at as string,
    error: r.error as string | null,
  }));
}

export type CreateContactEmailInput = {
  contactId: string;
  subject: string;
  body: string;
  fromAddr: string;
  toAddr: string;
  error?: string | null;
};

export function createContactEmail(db: DbArg, input: CreateContactEmailInput): ContactEmail {
  const sqlite = toSqlite(db);
  const id = randomUUID();
  const now = new Date().toISOString();
  sqlite.prepare(
    `INSERT INTO contact_emails (id, contact_id, direction, subject, body, from_addr, to_addr, sent_at, error)
     VALUES (?, ?, 'sent', ?, ?, ?, ?, ?, ?)`
  ).run(id, input.contactId, input.subject, input.body, input.fromAddr, input.toAddr, now, input.error ?? null);
  return {
    id,
    contactId: input.contactId,
    direction: 'sent',
    subject: input.subject,
    body: input.body,
    fromAddr: input.fromAddr,
    toAddr: input.toAddr,
    sentAt: now,
    error: input.error ?? null,
  };
}
