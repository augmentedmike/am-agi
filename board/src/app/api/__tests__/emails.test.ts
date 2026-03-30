import { describe, it, expect, beforeEach } from 'bun:test';
import { z } from 'zod';
import { createTestDb } from '@/db/client.test';
import { runMigrations } from '@/db/migrations';
import { createContact } from '@/db/contacts';
import {
  createEmail,
  createEmailSync,
  deleteEmail,
  getEmail,
  listEmailsByContact,
  listEmailAttachments,
} from '@/db/emails';

// Mirrors the zod schema in POST /api/emails route.ts
const createEmailSchema = z.object({
  providerId: z.string().min(1),
  syncId: z.string().min(1),
  contactId: z.string().nullish(),
  threadId: z.string().nullish(),
  subject: z.string().nullish(),
  fromAddress: z.string().min(1),
  toAddresses: z.array(z.string()).optional(),
  ccAddresses: z.array(z.string()).optional(),
  snippet: z.string().nullish(),
  bodyText: z.string().nullish(),
  labels: z.array(z.string()).optional(),
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  receivedAt: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Tests exercise the db functions that email route handlers wrap.
// Next.js-specific imports (NextRequest, NextResponse) are not available in bun test,
// so we test the logic layer directly with in-memory SQLite.

let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let db: ReturnType<typeof createTestDb>['db'];

function mkSync(overrides?: { provider?: string; accountEmail?: string }) {
  return createEmailSync({ sqlite }, {
    provider: overrides?.provider ?? 'gmail',
    accountEmail: overrides?.accountEmail ?? 'test@example.com',
  });
}

function mkEmail(syncId: string, overrides?: Partial<Parameters<typeof createEmail>[1]>) {
  return createEmail({ sqlite }, {
    providerId: `pid-${Math.random()}`,
    syncId,
    fromAddress: 'sender@example.com',
    receivedAt: new Date().toISOString(),
    ...overrides,
  });
}

beforeEach(() => {
  const instance = createTestDb();
  db = instance.db;
  sqlite = instance.sqlite;
  runMigrations(db, sqlite);
});

// ── GET /api/contacts/[id]/emails ─────────────────────────────────────────────

describe('GET /api/contacts/[id]/emails', () => {
  it('returns emails linked to a contact', () => {
    const contact = createContact({ sqlite }, { name: 'Alice' });
    const sync = mkSync();
    mkEmail(sync.id, { contactId: contact.id, subject: 'Hello' });
    mkEmail(sync.id, { contactId: contact.id, subject: 'World' });

    const emails = listEmailsByContact({ sqlite }, contact.id);
    expect(emails.length).toBe(2);
    expect(emails.map(e => e.subject)).toContain('Hello');
    expect(emails.map(e => e.subject)).toContain('World');
  });

  it('returns empty array when contact has no emails', () => {
    const contact = createContact({ sqlite }, { name: 'Bob' });
    const emails = listEmailsByContact({ sqlite }, contact.id);
    expect(emails).toEqual([]);
  });

  it('returns 404-equivalent (undefined contact) for unknown id', () => {
    const emails = listEmailsByContact({ sqlite }, 'nonexistent');
    expect(emails).toEqual([]);
  });
});

// ── POST /api/emails ──────────────────────────────────────────────────────────

describe('POST /api/emails', () => {
  it('creates an email record and returns it', () => {
    const sync = mkSync();
    const email = createEmail({ sqlite }, {
      providerId: 'gmail-msg-001',
      syncId: sync.id,
      fromAddress: 'alice@example.com',
      toAddresses: ['bob@example.com'],
      subject: 'Test subject',
      snippet: 'Preview text...',
      receivedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(email.id).toBeTruthy();
    expect(email.providerId).toBe('gmail-msg-001');
    expect(email.syncId).toBe(sync.id);
    expect(email.fromAddress).toBe('alice@example.com');
    expect(email.toAddresses).toEqual(['bob@example.com']);
    expect(email.subject).toBe('Test subject');
    expect(email.receivedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('creates email with optional contactId', () => {
    const contact = createContact({ sqlite }, { name: 'Charlie' });
    const sync = mkSync();
    const email = createEmail({ sqlite }, {
      providerId: 'gmail-msg-002',
      syncId: sync.id,
      contactId: contact.id,
      fromAddress: 'x@example.com',
      receivedAt: '2026-01-02T00:00:00.000Z',
    });

    expect(email.contactId).toBe(contact.id);
  });

  it('returns 400-equivalent when required fields are missing or empty', () => {
    // Route uses zod; test schema validation directly
    const missingProvider = createEmailSchema.safeParse({
      syncId: 'some-sync',
      fromAddress: 'x@example.com',
      receivedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(missingProvider.success).toBe(false);

    const emptyProviderId = createEmailSchema.safeParse({
      providerId: '',
      syncId: 'some-sync',
      fromAddress: 'x@example.com',
      receivedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(emptyProviderId.success).toBe(false);

    const missingFromAddress = createEmailSchema.safeParse({
      providerId: 'pid-1',
      syncId: 'some-sync',
      receivedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(missingFromAddress.success).toBe(false);
  });
});

// ── GET /api/emails/[id] ──────────────────────────────────────────────────────

describe('GET /api/emails/[id]', () => {
  it('returns email by id', () => {
    const sync = mkSync();
    const email = mkEmail(sync.id, { subject: 'Found it' });

    const found = getEmail({ sqlite }, email.id);
    expect(found).not.toBeNull();
    expect(found?.subject).toBe('Found it');
  });

  it('returns undefined for unknown id (404 equivalent)', () => {
    const found = getEmail({ sqlite }, 'does-not-exist');
    expect(found).toBeUndefined();
  });
});

// ── DELETE /api/emails/[id] ───────────────────────────────────────────────────

describe('DELETE /api/emails/[id]', () => {
  it('removes the email record', () => {
    const sync = mkSync();
    const email = mkEmail(sync.id);

    deleteEmail({ sqlite }, email.id);
    const found = getEmail({ sqlite }, email.id);
    expect(found).toBeUndefined();
  });

  it('cascades delete to attachments', () => {
    const sync = mkSync();
    const email = mkEmail(sync.id);

    // Insert an attachment directly
    const now = new Date().toISOString();
    sqlite.prepare(
      `INSERT INTO email_attachments (id, email_id, filename, mime_type, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('att-001', email.id, 'file.pdf', 'application/pdf', 1024, now);

    const beforeDelete = listEmailAttachments({ sqlite }, email.id);
    expect(beforeDelete.length).toBe(1);

    deleteEmail({ sqlite }, email.id);

    const afterDelete = listEmailAttachments({ sqlite }, email.id);
    expect(afterDelete.length).toBe(0);
    expect(getEmail({ sqlite }, email.id)).toBeUndefined();
  });

  it('silently succeeds for already-deleted email (idempotent)', () => {
    const sync = mkSync();
    const email = mkEmail(sync.id);
    deleteEmail({ sqlite }, email.id);
    // Should not throw
    expect(() => deleteEmail({ sqlite }, email.id)).not.toThrow();
  });
});
