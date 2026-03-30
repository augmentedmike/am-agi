import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  listContacts,
  searchContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  listMemories,
  createMemory,
  deleteMemory,
} from '../contacts';

const SCHEMA = `
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
    contact_id TEXT NOT NULL REFERENCES contacts(id),
    content TEXT,
    memory_ref TEXT,
    memory_term TEXT,
    created_at TEXT NOT NULL
  );
`;

type BunStatement = ReturnType<Database['prepare']>;

// Wrap bun:sqlite to match the better-sqlite3 API used in contacts.ts
function wrapSqlite(raw: Database) {
  return {
    prepare(sql: string) {
      const stmt: BunStatement = raw.prepare(sql);
      return {
        all: (...args: unknown[]) => stmt.all(...args),
        get: (...args: unknown[]) => stmt.get(...args),
        run: (...args: unknown[]) => stmt.run(...args),
      };
    },
  } as unknown as import('better-sqlite3').Database;
}

function makeTestDb() {
  const raw = new Database(':memory:');
  raw.run("PRAGMA foreign_keys = ON");
  raw.exec(SCHEMA);
  return { sqlite: wrapSqlite(raw) };
}

describe('contacts CRUD', () => {
  let db: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    db = makeTestDb();
  });

  it('listContacts returns empty array on fresh db', () => {
    expect(listContacts(db)).toEqual([]);
  });

  it('createContact creates a contact and getContact retrieves it', () => {
    const c = createContact(db, { name: 'Alice Smith', email: 'alice@example.com', company: 'Acme' });
    expect(c.name).toBe('Alice Smith');
    expect(c.email).toBe('alice@example.com');
    expect(c.company).toBe('Acme');
    expect(c.id).toBeTruthy();
    const found = getContact(db, c.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Alice Smith');
  });

  it('listContacts returns created contacts sorted by name', () => {
    createContact(db, { name: 'Bob' });
    createContact(db, { name: 'Carol' });
    const all = listContacts(db);
    expect(all.length).toBe(2);
    expect(all.map(c => c.name)).toContain('Bob');
    expect(all.map(c => c.name)).toContain('Carol');
  });

  it('searchContacts filters by name, email, company', () => {
    createContact(db, { name: 'Alice Smith', email: 'alice@acme.com', company: 'Acme' });
    createContact(db, { name: 'Bob Jones', email: 'bob@example.com', company: 'Beta Corp' });
    expect(searchContacts(db, 'alice').length).toBe(1);
    expect(searchContacts(db, 'Acme').length).toBe(1);
    expect(searchContacts(db, 'jones').length).toBe(1);
    expect(searchContacts(db, 'xyz').length).toBe(0);
  });

  it('updateContact updates fields', () => {
    const c = createContact(db, { name: 'Dave', email: 'dave@old.com' });
    const updated = updateContact(db, c.id, { email: 'dave@new.com', company: 'NewCo' });
    expect(updated!.email).toBe('dave@new.com');
    expect(updated!.company).toBe('NewCo');
    expect(updated!.name).toBe('Dave');
  });

  it('updateContact with no fields returns existing contact', () => {
    const c = createContact(db, { name: 'Eve' });
    const result = updateContact(db, c.id, {});
    expect(result!.name).toBe('Eve');
  });

  it('updateContact returns null for missing id', () => {
    const result = updateContact(db, 'no-such-id', { name: 'Ghost' });
    expect(result).toBeNull();
  });

  it('deleteContact removes contact and its memories', () => {
    const c = createContact(db, { name: 'Frank' });
    createMemory(db, c.id, 'met at conference');
    deleteContact(db, c.id);
    expect(getContact(db, c.id)).toBeUndefined();
    expect(listMemories(db, c.id)).toEqual([]);
  });

  it('getContact returns undefined for missing id', () => {
    expect(getContact(db, 'no-such-id')).toBeUndefined();
  });
});

describe('contact memories CRUD', () => {
  let db: ReturnType<typeof makeTestDb>;
  let contactId: string;

  beforeEach(() => {
    db = makeTestDb();
    const c = createContact(db, { name: 'Grace' });
    contactId = c.id;
  });

  it('listMemories returns empty for new contact', () => {
    expect(listMemories(db, contactId)).toEqual([]);
  });

  it('createMemory returns a properly mapped ContactMemory', () => {
    const m = createMemory(db, contactId, 'first note');
    expect(m.content).toBe('first note');
    expect(m.contactId).toBe(contactId);
    expect(m.id).toBeTruthy();
    expect(m.createdAt).toBeTruthy();
  });

  it('createMemory adds a memory and listMemories returns it', () => {
    createMemory(db, contactId, 'first note');
    const list = listMemories(db, contactId);
    expect(list.length).toBe(1);
    expect(list[0].content).toBe('first note');
    expect(list[0].contactId).toBe(contactId);
  });

  it('listMemories returns entries in created_at ascending order', () => {
    createMemory(db, contactId, 'alpha');
    createMemory(db, contactId, 'beta');
    createMemory(db, contactId, 'gamma');
    const list = listMemories(db, contactId);
    expect(list.map(m => m.content)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('deleteMemory removes a single memory', () => {
    const m1 = createMemory(db, contactId, 'keep me');
    const m2 = createMemory(db, contactId, 'delete me');
    deleteMemory(db, m2.id);
    const list = listMemories(db, contactId);
    expect(list.length).toBe(1);
    expect(list[0].content).toBe('keep me');
    // m1 survives
    expect(list[0].id).toBe(m1.id);
  });
});
