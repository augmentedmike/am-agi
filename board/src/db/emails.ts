import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { Email, EmailAttachment, EmailSync } from './schema';

// Accepts { sqlite } (better-sqlite3 compat) or drizzle db (which exposes $client)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSqlite(db: any): InstanceType<typeof Database> {
  return (db.sqlite ?? db.$client) as InstanceType<typeof Database>;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function parseJson<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw !== 'string') return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function rowToEmail(row: Record<string, unknown>): Email {
  return {
    id: row.id as string,
    providerId: row.provider_id as string,
    syncId: row.sync_id as string,
    contactId: (row.contact_id ?? null) as string | null,
    threadId: (row.thread_id ?? null) as string | null,
    subject: (row.subject ?? null) as string | null,
    fromAddress: row.from_address as string,
    toAddresses: parseJson<string[]>(row.to_addresses, []),
    ccAddresses: parseJson<string[]>(row.cc_addresses, []),
    snippet: (row.snippet ?? null) as string | null,
    bodyText: (row.body_text ?? null) as string | null,
    labels: parseJson<string[]>(row.labels, []),
    isRead: Boolean(row.is_read),
    isStarred: Boolean(row.is_starred),
    receivedAt: row.received_at as string,
    metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToEmailSync(row: Record<string, unknown>): EmailSync {
  return {
    id: row.id as string,
    provider: row.provider as 'gmail' | 'outlook' | 'imap',
    accountEmail: row.account_email as string,
    lastSyncAt: (row.last_sync_at ?? null) as string | null,
    syncStatus: (row.sync_status ?? 'idle') as 'idle' | 'syncing' | 'error',
    errorMessage: (row.error_message ?? null) as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToAttachment(row: Record<string, unknown>): EmailAttachment {
  return {
    id: row.id as string,
    emailId: row.email_id as string,
    filename: row.filename as string,
    mimeType: row.mime_type as string,
    sizeBytes: (row.size_bytes ?? 0) as number,
    providerAttachmentId: (row.provider_attachment_id ?? null) as string | null,
    createdAt: row.created_at as string,
  };
}

// ── email_syncs ───────────────────────────────────────────────────────────────

export function listEmailSyncs(db: Db): EmailSync[] {
  const sqlite = getSqlite(db);
  const rows = sqlite.prepare('SELECT * FROM email_syncs ORDER BY created_at ASC').all() as Record<string, unknown>[];
  return rows.map(rowToEmailSync);
}

export function getEmailSync(db: Db, id: string): EmailSync | null {
  const sqlite = getSqlite(db);
  const row = sqlite.prepare('SELECT * FROM email_syncs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToEmailSync(row) : null;
}

export type CreateEmailSyncInput = {
  provider: string;
  accountEmail: string;
};

export function createEmailSync(db: Db, data: CreateEmailSyncInput): EmailSync {
  const sqlite = getSqlite(db);
  const now = new Date().toISOString();
  const id = randomUUID();
  sqlite.prepare(
    `INSERT INTO email_syncs (id, provider, account_email, sync_status, created_at, updated_at)
     VALUES (?, ?, ?, 'idle', ?, ?)`
  ).run(id, data.provider, data.accountEmail, now, now);
  return getEmailSync(db, id)!;
}

export function deleteEmailSync(db: Db, id: string): boolean {
  const sqlite = getSqlite(db);
  sqlite.prepare('DELETE FROM emails WHERE sync_id = ?').run(id);
  const result = sqlite.prepare('DELETE FROM email_syncs WHERE id = ?').run(id) as { changes: number };
  return result.changes > 0;
}

// ── emails ────────────────────────────────────────────────────────────────────

export function getEmail(db: Db, id: string): Email | undefined {
  const sqlite = getSqlite(db);
  const row = sqlite.prepare('SELECT * FROM emails WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToEmail(row) : undefined;
}

export function listEmailsByContact(db: Db, contactId: string): Email[] {
  const sqlite = getSqlite(db);
  const rows = sqlite.prepare(
    'SELECT * FROM emails WHERE contact_id = ? ORDER BY received_at DESC'
  ).all(contactId) as Record<string, unknown>[];
  return rows.map(rowToEmail);
}

export type CreateEmailInput = {
  providerId: string;
  syncId: string;
  contactId?: string | null;
  threadId?: string | null;
  subject?: string | null;
  fromAddress: string;
  toAddresses?: string[];
  ccAddresses?: string[];
  snippet?: string | null;
  bodyText?: string | null;
  labels?: string[];
  isRead?: boolean;
  isStarred?: boolean;
  receivedAt: string;
  metadata?: Record<string, unknown>;
};

export function createEmail(db: Db, data: CreateEmailInput): Email {
  const sqlite = getSqlite(db);
  const now = new Date().toISOString();
  const id = randomUUID();
  sqlite.prepare(
    `INSERT INTO emails (
       id, provider_id, sync_id, contact_id, thread_id, subject, from_address,
       to_addresses, cc_addresses, snippet, body_text, labels,
       is_read, is_starred, received_at, metadata, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.providerId,
    data.syncId,
    data.contactId ?? null,
    data.threadId ?? null,
    data.subject ?? null,
    data.fromAddress,
    JSON.stringify(data.toAddresses ?? []),
    JSON.stringify(data.ccAddresses ?? []),
    data.snippet ?? null,
    data.bodyText ?? null,
    JSON.stringify(data.labels ?? []),
    data.isRead ? 1 : 0,
    data.isStarred ? 1 : 0,
    data.receivedAt,
    JSON.stringify(data.metadata ?? {}),
    now,
    now
  );
  return getEmail(db, id)!;
}

export function deleteEmail(db: Db, id: string): boolean {
  const sqlite = getSqlite(db);
  // email_attachments cascade on delete, but be explicit just in case
  sqlite.prepare('DELETE FROM email_attachments WHERE email_id = ?').run(id);
  const result = sqlite.prepare('DELETE FROM emails WHERE id = ?').run(id) as { changes: number };
  return result.changes > 0;
}

// upsertEmail — insert or ignore based on provider_id (natural dedup key).
// Used by the IMAP sync route which supplies a messageId as the providerId.
export interface UpsertEmailInput {
  id: string;
  messageId: string;
  inReplyTo?: string | null;
  references?: string | null;
  fromAddress: string;
  fromName?: string;
  toAddresses: string[];
  ccAddresses?: string[];
  subject?: string | null;
  bodyText?: string;
  bodyHtml?: string;
  attachments?: unknown[];
  folder?: string;
  isRead?: boolean;
  isStarred?: boolean;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export async function upsertEmail(db: Db, data: UpsertEmailInput): Promise<void> {
  const sqlite = getSqlite(db);
  sqlite.prepare(
    `INSERT OR IGNORE INTO emails (
       id, provider_id, sync_id, contact_id, thread_id, subject, from_address,
       to_addresses, cc_addresses, snippet, body_text, labels,
       is_read, is_starred, received_at, metadata, created_at, updated_at
     ) VALUES (?, ?, '', NULL, NULL, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, '{}', ?, ?)`
  ).run(
    data.id,
    data.messageId,
    data.subject ?? null,
    data.fromAddress,
    JSON.stringify(data.toAddresses),
    JSON.stringify(data.ccAddresses ?? []),
    null,
    data.bodyText ?? null,
    data.isRead ? 1 : 0,
    data.isStarred ? 1 : 0,
    data.date,
    data.createdAt,
    data.updatedAt,
  );
}

// ── email_attachments ─────────────────────────────────────────────────────────

export function listEmailAttachments(db: Db, emailId: string): EmailAttachment[] {
  const sqlite = getSqlite(db);
  const rows = sqlite.prepare(
    'SELECT * FROM email_attachments WHERE email_id = ? ORDER BY created_at ASC'
  ).all(emailId) as Record<string, unknown>[];
  return rows.map(rowToAttachment);
}

export function createEmailAttachment(
  db: Db,
  data: { emailId: string; filename: string; mimeType: string; sizeBytes?: number; providerAttachmentId?: string | null }
): EmailAttachment {
  const sqlite = getSqlite(db);
  const now = new Date().toISOString();
  const id = randomUUID();
  sqlite.prepare(
    `INSERT INTO email_attachments (id, email_id, filename, mime_type, size_bytes, provider_attachment_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.emailId, data.filename, data.mimeType, data.sizeBytes ?? 0, data.providerAttachmentId ?? null, now);
  const row = sqlite.prepare('SELECT * FROM email_attachments WHERE id = ?').get(id) as Record<string, unknown>;
  return rowToAttachment(row);
}
