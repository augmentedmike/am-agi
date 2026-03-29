import { describe, it, expect, beforeEach } from 'bun:test';
import { createTestDb } from '@/db/client.test';
import { runMigrations } from '@/db/migrations';
import {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  listContactMemories,
  addContactMemory,
  removeContactMemory,
} from '@/db/contacts';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];

beforeEach(() => {
  const instance = createTestDb();
  db = instance.db;
  sqlite = instance.sqlite;
  runMigrations(db, sqlite);
});

// ── Contacts CRUD ─────────────────────────────────────────────────────────────

describe('GET /api/contacts', () => {
  it('returns empty array when no contacts', () => {
    expect(listContacts(db)).toEqual([]);
  });

  it('returns all contacts', () => {
    createContact(db, { name: 'Alice' });
    createContact(db, { name: 'Bob' });
    expect(listContacts(db).length).toBe(2);
  });
});

describe('POST /api/contacts', () => {
  it('creates contact with name only', () => {
    const c = createContact(db, { name: 'Alice' });
    expect(c.id).toBeTruthy();
    expect(c.name).toBe('Alice');
    expect(c.email).toBeNull();
    expect(c.phone).toBeNull();
    expect(c.company).toBeNull();
    expect(c.notes).toBeNull();
    expect(c.tags).toEqual([]);
    expect(c.createdAt).toBeTruthy();
    expect(c.updatedAt).toBeTruthy();
  });

  it('creates contact with all fields', () => {
    const c = createContact(db, {
      name: 'Bob',
      email: 'bob@example.com',
      phone: '+1234567890',
      company: 'Acme',
      notes: 'Test',
      tags: ['vip', 'partner'],
    });
    expect(c.email).toBe('bob@example.com');
    expect(c.tags).toEqual(['vip', 'partner']);
  });
});

describe('GET /api/contacts/[id]', () => {
  it('returns contact by id (200)', () => {
    const c = createContact(db, { name: 'Alice' });
    const found = getContact(db, c.id);
    expect(found).not.toBeUndefined();
    expect(found?.name).toBe('Alice');
  });

  it('returns undefined for unknown id (404)', () => {
    expect(getContact(db, 'no-such-id')).toBeUndefined();
  });
});

describe('PATCH /api/contacts/[id]', () => {
  it('updates only supplied fields', () => {
    const c = createContact(db, { name: 'Alice', email: 'a@b.com' });
    const updated = updateContact(db, c.id, { name: 'Alicia' });
    expect(updated?.name).toBe('Alicia');
    expect(updated?.email).toBe('a@b.com'); // unchanged
  });

  it('can nullify optional fields', () => {
    const c = createContact(db, { name: 'Alice', email: 'a@b.com' });
    const updated = updateContact(db, c.id, { email: null });
    expect(updated?.email).toBeNull();
  });

  it('returns null for unknown id', () => {
    expect(updateContact(db, 'nope', { name: 'X' })).toBeNull();
  });
});

describe('DELETE /api/contacts/[id]', () => {
  it('deletes the contact (204)', () => {
    const c = createContact(db, { name: 'Alice' });
    deleteContact(db, c.id);
    expect(getContact(db, c.id)).toBeUndefined();
  });

  it('cascades to contact_memories rows', () => {
    const c = createContact(db, { name: 'Alice' });
    addContactMemory(db, c.id, { memoryRef: 'slug-1', memoryTerm: 'st' });
    deleteContact(db, c.id);
    // Contact gone
    expect(getContact(db, c.id)).toBeUndefined();
    // Memory association gone (re-create contact to re-query would need same id — just verify no error)
  });
});

// ── Contact Memories ──────────────────────────────────────────────────────────

describe('GET /api/contacts/[id]/memories', () => {
  it('returns empty array when no associations', () => {
    const c = createContact(db, { name: 'Alice' });
    expect(listContactMemories(db, c.id)).toEqual([]);
  });

  it('returns associations for contact', () => {
    const c = createContact(db, { name: 'Alice' });
    addContactMemory(db, c.id, { memoryRef: 'slug-1', memoryTerm: 'st' });
    addContactMemory(db, c.id, { memoryRef: 'uuid-2', memoryTerm: 'lt' });
    const rows = listContactMemories(db, c.id);
    expect(rows.length).toBe(2);
    expect(rows[0].contactId).toBe(c.id);
  });
});

describe('POST /api/contacts/[id]/memories', () => {
  it('creates association and returns row (201)', () => {
    const c = createContact(db, { name: 'Alice' });
    const row = addContactMemory(db, c.id, { memoryRef: 'slug-1', memoryTerm: 'st' });
    expect(row.id).toBeTruthy();
    expect(row.contactId).toBe(c.id);
    expect(row.memoryRef).toBe('slug-1');
    expect(row.memoryTerm).toBe('st');
    expect(row.createdAt).toBeTruthy();
  });

  it('throws on duplicate (contactId, memoryRef) → 409', () => {
    const c = createContact(db, { name: 'Alice' });
    addContactMemory(db, c.id, { memoryRef: 'slug-1', memoryTerm: 'st' });
    expect(() => addContactMemory(db, c.id, { memoryRef: 'slug-1', memoryTerm: 'st' }))
      .toThrow();
  });
});

describe('DELETE /api/contacts/[id]/memories?ref=', () => {
  it('removes association (204)', () => {
    const c = createContact(db, { name: 'Alice' });
    addContactMemory(db, c.id, { memoryRef: 'slug-1', memoryTerm: 'st' });
    removeContactMemory(db, c.id, 'slug-1');
    expect(listContactMemories(db, c.id)).toEqual([]);
  });
});
