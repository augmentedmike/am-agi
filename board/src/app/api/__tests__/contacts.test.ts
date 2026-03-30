import { describe, it, expect, beforeEach } from 'bun:test';
import { createTestDb } from '@/db/client.test';
import { runMigrations } from '@/db/migrations';
import {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  listMemories,
  createMemory,
  deleteMemory,
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
    expect(listContacts({ sqlite })).toEqual([]);
  });

  it('returns all contacts', () => {
    createContact({ sqlite }, { name: 'Alice' });
    createContact({ sqlite }, { name: 'Bob' });
    expect(listContacts({ sqlite }).length).toBe(2);
  });
});

describe('POST /api/contacts', () => {
  it('creates contact with name only', () => {
    const c = createContact({ sqlite }, { name: 'Alice' });
    expect(c.id).toBeTruthy();
    expect(c.name).toBe('Alice');
    expect(c.email).toBeNull();
    expect(c.phone).toBeNull();
    expect(c.company).toBeNull();
    expect(c.title).toBeNull();
    expect(c.tags).toEqual([]);
    expect(c.createdAt).toBeTruthy();
    expect(c.updatedAt).toBeTruthy();
  });

  it('creates contact with all fields', () => {
    const c = createContact({ sqlite }, {
      name: 'Bob',
      email: 'bob@example.com',
      phone: '+1234567890',
      company: 'Acme',
      title: 'Engineer',
      tags: 'vip,partner',
    });
    expect(c.email).toBe('bob@example.com');
    expect(c.tags).toBe('vip,partner');
  });
});

describe('GET /api/contacts/[id]', () => {
  it('returns contact by id (200)', () => {
    const c = createContact({ sqlite }, { name: 'Alice' });
    const found = getContact({ sqlite }, c.id);
    expect(found).not.toBeUndefined();
    expect(found?.name).toBe('Alice');
  });

  it('returns undefined for unknown id (404)', () => {
    expect(getContact({ sqlite }, 'no-such-id')).toBeUndefined();
  });
});

describe('PATCH /api/contacts/[id]', () => {
  it('updates only supplied fields', () => {
    const c = createContact({ sqlite }, { name: 'Alice', email: 'a@b.com' });
    const updated = updateContact({ sqlite }, c.id, { name: 'Alicia' });
    expect(updated?.name).toBe('Alicia');
    expect(updated?.email).toBe('a@b.com'); // unchanged
  });

  it('can nullify optional fields', () => {
    const c = createContact({ sqlite }, { name: 'Alice', email: 'a@b.com' });
    const updated = updateContact({ sqlite }, c.id, { email: null });
    expect(updated?.email).toBeNull();
  });

  it('returns null for unknown id', () => {
    expect(updateContact({ sqlite }, 'nope', { name: 'X' })).toBeNull();
  });
});

describe('DELETE /api/contacts/[id]', () => {
  it('deletes the contact (204)', () => {
    const c = createContact({ sqlite }, { name: 'Alice' });
    deleteContact({ sqlite }, c.id);
    expect(getContact({ sqlite }, c.id)).toBeUndefined();
  });

  it('cascades to contact_memories rows', () => {
    const c = createContact({ sqlite }, { name: 'Alice' });
    createMemory({ sqlite }, c.id, 'some memory content');
    deleteContact({ sqlite }, c.id);
    expect(getContact({ sqlite }, c.id)).toBeUndefined();
    // Memories deleted via cascade — no error
  });
});

// ── Contact Memories ──────────────────────────────────────────────────────────

describe('GET /api/contacts/[id]/memories', () => {
  it('returns empty array when no memories', () => {
    const c = createContact({ sqlite }, { name: 'Alice' });
    expect(listMemories({ sqlite }, c.id)).toEqual([]);
  });

  it('returns memories for contact', () => {
    const c = createContact({ sqlite }, { name: 'Alice' });
    createMemory({ sqlite }, c.id, 'first note');
    createMemory({ sqlite }, c.id, 'second note');
    const rows = listMemories({ sqlite }, c.id);
    expect(rows.length).toBe(2);
    expect(rows[0].contactId).toBe(c.id);
  });
});

describe('POST /api/contacts/[id]/memories', () => {
  it('creates memory and returns row (201)', () => {
    const c = createContact({ sqlite }, { name: 'Alice' });
    const row = createMemory({ sqlite }, c.id, 'meeting note');
    expect(row.id).toBeTruthy();
    expect(row.contactId).toBe(c.id);
    expect(row.content).toBe('meeting note');
    expect(row.createdAt).toBeTruthy();
  });
});

describe('DELETE /api/contacts/[id]/memories', () => {
  it('removes memory by id (204)', () => {
    const c = createContact({ sqlite }, { name: 'Alice' });
    const row = createMemory({ sqlite }, c.id, 'to delete');
    deleteMemory({ sqlite }, row.id);
    expect(listMemories({ sqlite }, c.id)).toEqual([]);
  });
});
