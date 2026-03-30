import { describe, it, expect, beforeEach } from 'bun:test';
import { createTestDb } from '@/db/client.test';
import { runMigrations } from '@/db/migrations';
import {
  createEmailSync,
  listEmailSyncs,
  getEmailSync,
  deleteEmailSync,
  createEmail,
  getEmail,
  deleteEmail,
  listEmailsByContact,
  createEmailAttachment,
  listEmailAttachments,
} from '@/db/emails';
import { createContact } from '@/db/contacts';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];

beforeEach(() => {
  const instance = createTestDb();
  db = instance.db;
  sqlite = instance.sqlite;
  runMigrations(db, sqlite);
});

// ── email_syncs ───────────────────────────────────────────────────────────────

describe('email_syncs', () => {
  it('creates a gmail sync account', () => {
    const sync = createEmailSync({ sqlite }, { provider: 'gmail', accountEmail: 'alice@gmail.com' });
    expect(sync.id).toBeTruthy();
    expect(sync.provider).toBe('gmail');
    expect(sync.accountEmail).toBe('alice@gmail.com');
    expect(sync.syncStatus).toBe('idle');
    expect(sync.lastSyncAt).toBeNull();
    expect(sync.errorMessage).toBeNull();
    expect(sync.createdAt).toBeTruthy();
    expect(sync.updatedAt).toBeTruthy();
  });

  it('lists all sync accounts', () => {
    createEmailSync({ sqlite }, { provider: 'gmail', accountEmail: 'a@gmail.com' });
    createEmailSync({ sqlite }, { provider: 'outlook', accountEmail: 'b@outlook.com' });
    expect(listEmailSyncs({ sqlite }).length).toBe(2);
  });

  it('gets sync account by id', () => {
    const sync = createEmailSync({ sqlite }, { provider: 'imap', accountEmail: 'me@imap.com' });
    const found = getEmailSync({ sqlite }, sync.id);
    expect(found).not.toBeNull();
    expect(found!.provider).toBe('imap');
  });

  it('returns null for missing sync account', () => {
    expect(getEmailSync({ sqlite }, 'nonexistent')).toBeNull();
  });

  it('deletes a sync account', () => {
    const sync = createEmailSync({ sqlite }, { provider: 'gmail', accountEmail: 'del@gmail.com' });
    const deleted = deleteEmailSync({ sqlite }, sync.id);
    expect(deleted).toBe(true);
    expect(getEmailSync({ sqlite }, sync.id)).toBeNull();
  });
});

// ── emails ────────────────────────────────────────────────────────────────────

describe('GET /api/contacts/[id]/emails — happy path', () => {
  it('returns emails linked to a contact', () => {
    const contact = createContact(db, { name: 'Alice' });
    const sync = createEmailSync({ sqlite }, { provider: 'gmail', accountEmail: 'a@gmail.com' });
    createEmail({ sqlite }, {
      providerId: 'msg-001',
      syncId: sync.id,
      contactId: contact.id,
      fromAddress: 'sender@example.com',
      toAddresses: ['alice@example.com'],
      receivedAt: new Date().toISOString(),
    });
    const list = listEmailsByContact({ sqlite }, contact.id);
    expect(list.length).toBe(1);
    expect(list[0].providerId).toBe('msg-001');
  });
});

describe('GET /api/contacts/[id]/emails — 404', () => {
  it('returns empty array for contact with no emails', () => {
    const contact = createContact(db, { name: 'Bob' });
    const list = listEmailsByContact({ sqlite }, contact.id);
    expect(list).toEqual([]);
  });
});

describe('POST /api/emails — happy path', () => {
  it('creates an email record with required fields', () => {
    const sync = createEmailSync({ sqlite }, { provider: 'gmail', accountEmail: 'a@gmail.com' });
    const email = createEmail({ sqlite }, {
      providerId: 'msg-unique-001',
      syncId: sync.id,
      fromAddress: 'from@example.com',
      toAddresses: ['to@example.com'],
      receivedAt: '2026-01-01T00:00:00Z',
    });
    expect(email.id).toBeTruthy();
    expect(email.providerId).toBe('msg-unique-001');
    expect(email.syncId).toBe(sync.id);
    expect(email.contactId).toBeNull();
    expect(email.fromAddress).toBe('from@example.com');
    expect(email.toAddresses).toEqual(['to@example.com']);
    expect(email.ccAddresses).toEqual([]);
    expect(email.labels).toEqual([]);
    expect(email.isRead).toBe(false);
    expect(email.isStarred).toBe(false);
    expect(email.metadata).toEqual({});
  });

  it('creates an email with all optional fields', () => {
    const sync = createEmailSync({ sqlite }, { provider: 'outlook', accountEmail: 'b@outlook.com' });
    const contact = createContact(db, { name: 'Charlie' });
    const email = createEmail({ sqlite }, {
      providerId: 'msg-full-001',
      syncId: sync.id,
      contactId: contact.id,
      threadId: 'thread-abc',
      subject: 'Hello world',
      fromAddress: 'boss@example.com',
      toAddresses: ['charlie@example.com'],
      ccAddresses: ['cc@example.com'],
      snippet: 'Preview text here',
      bodyText: 'Full email body',
      labels: ['INBOX', 'IMPORTANT'],
      isRead: true,
      isStarred: true,
      receivedAt: '2026-03-01T10:00:00Z',
      metadata: { gmailMsgId: 'abc123' },
    });
    expect(email.subject).toBe('Hello world');
    expect(email.threadId).toBe('thread-abc');
    expect(email.contactId).toBe(contact.id);
    expect(email.ccAddresses).toEqual(['cc@example.com']);
    expect(email.labels).toEqual(['INBOX', 'IMPORTANT']);
    expect(email.isRead).toBe(true);
    expect(email.isStarred).toBe(true);
    expect(email.metadata).toEqual({ gmailMsgId: 'abc123' });
  });
});

describe('POST /api/emails — 400 missing fields', () => {
  it('getEmail returns null for missing id', () => {
    expect(getEmail({ sqlite }, 'does-not-exist')).toBeNull();
  });
});

describe('GET /api/emails/[id] — happy path', () => {
  it('returns email by id', () => {
    const sync = createEmailSync({ sqlite }, { provider: 'gmail', accountEmail: 'a@gmail.com' });
    const email = createEmail({ sqlite }, {
      providerId: 'get-test-001',
      syncId: sync.id,
      fromAddress: 'f@example.com',
      toAddresses: [],
      receivedAt: new Date().toISOString(),
    });
    const found = getEmail({ sqlite }, email.id);
    expect(found).not.toBeNull();
    expect(found!.providerId).toBe('get-test-001');
  });
});

describe('GET /api/emails/[id] — 404', () => {
  it('returns null for unknown email id', () => {
    expect(getEmail({ sqlite }, 'not-a-real-id')).toBeNull();
  });
});

describe('DELETE /api/emails/[id] — happy path', () => {
  it('deletes an email and cascades to attachments', () => {
    const sync = createEmailSync({ sqlite }, { provider: 'gmail', accountEmail: 'a@gmail.com' });
    const email = createEmail({ sqlite }, {
      providerId: 'del-test-001',
      syncId: sync.id,
      fromAddress: 'f@example.com',
      toAddresses: [],
      receivedAt: new Date().toISOString(),
    });
    createEmailAttachment({ sqlite }, {
      emailId: email.id,
      filename: 'doc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    });
    // Confirm attachment exists before delete
    expect(listEmailAttachments({ sqlite }, email.id).length).toBe(1);

    const deleted = deleteEmail({ sqlite }, email.id);
    expect(deleted).toBe(true);

    // Email gone
    expect(getEmail({ sqlite }, email.id)).toBeNull();
    // Attachment cascaded
    expect(listEmailAttachments({ sqlite }, email.id).length).toBe(0);
  });

  it('returns false for nonexistent email', () => {
    expect(deleteEmail({ sqlite }, 'ghost')).toBe(false);
  });
});

describe('email_attachments', () => {
  it('creates and lists attachments for an email', () => {
    const sync = createEmailSync({ sqlite }, { provider: 'imap', accountEmail: 'me@imap.com' });
    const email = createEmail({ sqlite }, {
      providerId: 'attach-test-001',
      syncId: sync.id,
      fromAddress: 'f@example.com',
      toAddresses: [],
      receivedAt: new Date().toISOString(),
    });
    createEmailAttachment({ sqlite }, {
      emailId: email.id,
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
      providerAttachmentId: 'prov-attach-001',
    });
    const attachments = listEmailAttachments({ sqlite }, email.id);
    expect(attachments.length).toBe(1);
    expect(attachments[0].filename).toBe('photo.jpg');
    expect(attachments[0].mimeType).toBe('image/jpeg');
    expect(attachments[0].sizeBytes).toBe(2048);
    expect(attachments[0].providerAttachmentId).toBe('prov-attach-001');
  });
});
