import { eq, asc, desc, like, and, SQL } from 'drizzle-orm';
import { chatMessages, ChatRole, ChatStatus } from './schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { randomUUID } from 'crypto';

type Db = BetterSQLite3Database<typeof schema>;

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  status: ChatStatus;
  replyToId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function listChatMessages(db: Db, opts?: { status?: ChatStatus; limit?: number; search?: string }): ChatMessage[] {
  const conditions: SQL[] = [];
  if (opts?.status) conditions.push(eq(chatMessages.status, opts.status));
  if (opts?.search) conditions.push(like(chatMessages.content, `%${opts.search}%`));

  const q = db.select().from(chatMessages);
  const filtered = conditions.length > 0
    ? q.where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : q;

  // Fetch newest N first, then reverse so caller gets chronological order
  const rows = filtered.orderBy(desc(chatMessages.createdAt)).limit(opts?.limit ?? 50).all() as ChatMessage[];
  return rows.reverse();
}

export function getChatMessage(db: Db, id: string): ChatMessage | undefined {
  return db.select().from(chatMessages).where(eq(chatMessages.id, id)).get() as ChatMessage | undefined;
}

export function createChatMessage(db: Db, input: { role: ChatRole; content: string; status?: ChatStatus; replyToId?: string }): ChatMessage {
  const now = new Date().toISOString();
  const id = randomUUID();
  const status: ChatStatus = input.status ?? (input.role === 'user' ? 'pending' : 'done');
  db.insert(chatMessages).values({
    id,
    role: input.role,
    content: input.content,
    status,
    replyToId: input.replyToId ?? null,
    createdAt: now,
    updatedAt: now,
  }).run();
  return { id, role: input.role, content: input.content, status, replyToId: input.replyToId ?? null, createdAt: now, updatedAt: now };
}

export function updateChatMessage(db: Db, id: string, input: { content?: string; status?: ChatStatus }): ChatMessage | undefined {
  const now = new Date().toISOString();
  const updates: Partial<{ content: string; status: ChatStatus; updatedAt: string }> = { updatedAt: now };
  if (input.content !== undefined) updates.content = input.content;
  if (input.status !== undefined) updates.status = input.status;
  db.update(chatMessages).set(updates).where(eq(chatMessages.id, id)).run();
  return getChatMessage(db, id);
}

export function deleteChatMessage(db: Db, id: string): boolean {
  const msg = getChatMessage(db, id);
  if (!msg) return false;
  db.delete(chatMessages).where(eq(chatMessages.id, id)).run();
  return true;
}

export function getLastUserMessage(db: Db): ChatMessage | undefined {
  return db.select().from(chatMessages)
    .where(eq(chatMessages.role, 'user'))
    .orderBy(desc(chatMessages.createdAt))
    .limit(1)
    .get() as ChatMessage | undefined;
}
