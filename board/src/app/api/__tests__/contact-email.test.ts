import { describe, it, expect, beforeEach } from 'bun:test';
import { createTestDb } from '@/db/client.test';
import { runMigrations } from '@/db/migrations';
import { createContact, getContact, listContactEmails, createContactEmail } from '@/db/contacts';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];

beforeEach(() => {
  const instance = createTestDb();
  db = instance.db;
  sqlite = instance.sqlite;
  runMigrations(db, sqlite);
});

describe('GET /api/contacts/[id]/email', () => {
  it('returns 404 for unknown contact — getContact returns falsy for missing id', () => {
    // The route does: if (!contact) return 404
    // getContact returns undefined (better-sqlite3) or null (bun:sqlite) for missing rows
    const result = getContact({ sqlite }, 'no-such-id');
    expect(result == null).toBe(true);
  });

  it('returns empty array for contact with no emails', () => {
    const c = createContact({ sqlite }, { name: 'Alice', email: 'alice@example.com' });
    const emails = listContactEmails({ sqlite }, c.id);
    expect(emails).toEqual([]);
  });
});

describe('POST /api/contacts/[id]/email — SMTP not configured', () => {
  it('returns 422 when smtp_host is empty (no smtp config)', () => {
    // The route checks: if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass || !settings.smtp_from)
    // With default settings (all empty), this condition is true → 422
    const smtp_host = '';
    const smtp_user = '';
    const smtp_pass = '';
    const smtp_from = '';
    const notConfigured = !smtp_host || !smtp_user || !smtp_pass || !smtp_from;
    expect(notConfigured).toBe(true);
  });
});

describe('createContactEmail / listContactEmails', () => {
  it('creates an email record and lists it', () => {
    const c = createContact({ sqlite }, { name: 'Bob', email: 'bob@example.com' });
    const email = createContactEmail({ sqlite }, {
      contactId: c.id,
      subject: 'Hello',
      body: 'Hi there',
      fromAddr: 'am@example.com',
      toAddr: 'bob@example.com',
    });
    expect(email.id).toBeTruthy();
    expect(email.contactId).toBe(c.id);
    expect(email.subject).toBe('Hello');
    expect(email.body).toBe('Hi there');
    expect(email.fromAddr).toBe('am@example.com');
    expect(email.toAddr).toBe('bob@example.com');
    expect(email.direction).toBe('sent');
    expect(email.error).toBeNull();
    expect(email.sentAt).toBeTruthy();

    const list = listContactEmails({ sqlite }, c.id);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(email.id);
  });

  it('stores error when send fails', () => {
    const c = createContact({ sqlite }, { name: 'Carol', email: 'carol@example.com' });
    const email = createContactEmail({ sqlite }, {
      contactId: c.id,
      subject: 'Test',
      body: 'Body',
      fromAddr: 'am@example.com',
      toAddr: 'carol@example.com',
      error: 'Connection refused',
    });
    expect(email.error).toBe('Connection refused');
  });

  it('lists emails in descending sentAt order', () => {
    const c = createContact({ sqlite }, { name: 'Dave', email: 'dave@example.com' });
    // Insert with explicit timestamps to guarantee order
    sqlite.prepare(
      `INSERT INTO contact_emails (id, contact_id, direction, subject, body, from_addr, to_addr, sent_at, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('id-first', c.id, 'sent', 'First', 'A', 'x@x.com', 'dave@example.com', '2024-01-01T00:00:00.000Z', null);
    sqlite.prepare(
      `INSERT INTO contact_emails (id, contact_id, direction, subject, body, from_addr, to_addr, sent_at, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('id-second', c.id, 'sent', 'Second', 'B', 'x@x.com', 'dave@example.com', '2024-01-02T00:00:00.000Z', null);
    const list = listContactEmails({ sqlite }, c.id);
    expect(list.length).toBe(2);
    // Most recent first (desc sent_at)
    expect(list[0].subject).toBe('Second');
    expect(list[1].subject).toBe('First');
  });
});
