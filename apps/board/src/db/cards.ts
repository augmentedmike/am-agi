import { eq, and, sql } from 'drizzle-orm';
import { cards, iterations, CardState, CardPriority, WorkLogEntry, Attachment } from './schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { randomUUID } from 'crypto';

type Db = BetterSQLite3Database<typeof schema>;

export function listCards(
  db: Db,
  filters?: { state?: CardState; priority?: CardPriority }
) {
  const conditions = [sql`${cards.archived} = 0`];
  if (filters?.state) conditions.push(eq(cards.state, filters.state));
  if (filters?.priority) conditions.push(eq(cards.priority, filters.priority));
  return db.select().from(cards).where(and(...conditions)).all();
}

export function getCard(db: Db, id: string) {
  return db.select().from(cards).where(eq(cards.id, id)).get();
}

export type CreateCardInput = {
  title: string;
  priority?: CardPriority;
  workDir?: string;
};

export function createCard(db: Db, input: CreateCardInput) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const card = {
    id,
    title: input.title,
    state: 'backlog' as CardState,
    priority: input.priority ?? 'normal' as CardPriority,
    attachments: [] as Attachment[],
    workLog: [] as WorkLogEntry[],
    workDir: input.workDir ?? null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(cards).values(card).run();
  return card;
}

export type UpdateCardInput = {
  title?: string;
  priority?: CardPriority;
  workLogEntry?: WorkLogEntry;
  attachment?: Attachment;
  attachments?: string[];
  removeAttachment?: string;
  workDir?: string;
};

export function updateCard(db: Db, id: string, input: UpdateCardInput) {
  const card = getCard(db, id);
  if (!card) return null;
  const now = new Date().toISOString();
  const newWorkLog = input.workLogEntry
    ? [...card.workLog, input.workLogEntry]
    : card.workLog;
  const existingPaths = new Set(card.attachments.map(a => a.path));
  const addedFromPaths: Attachment[] = (input.attachments ?? [])
    .filter(p => !existingPaths.has(p))
    .map(p => ({ path: p, name: p.split('/').pop() ?? p }));
  const addedFromSingle: Attachment[] = input.attachment && !existingPaths.has(input.attachment.path)
    ? [input.attachment]
    : [];
  const merged = [...card.attachments, ...addedFromPaths, ...addedFromSingle];
  const newAttachments = input.removeAttachment
    ? merged.filter(a => a.path !== input.removeAttachment)
    : merged;
  db.update(cards)
    .set({
      title: input.title ?? card.title,
      priority: input.priority ?? card.priority,
      workLog: newWorkLog,
      attachments: newAttachments,
      workDir: input.workDir ?? card.workDir,
      updatedAt: now,
    })
    .where(eq(cards.id, id))
    .run();
  return getCard(db, id);
}

export function moveCard(db: Db, id: string, newState: CardState) {
  const now = new Date().toISOString();
  const existing = getCard(db, id);
  const updates: Record<string, unknown> = { state: newState, updatedAt: now };
  if (newState === 'in-progress' && !existing?.inProgressAt) updates.inProgressAt = now;
  if (newState === 'in-review' && !existing?.inReviewAt) updates.inReviewAt = now;
  if (newState === 'shipped' && !existing?.shippedAt) updates.shippedAt = now;
  db.update(cards).set(updates).where(eq(cards.id, id)).run();
  return getCard(db, id);
}

export function archiveCard(db: Db, id: string) {
  const now = new Date().toISOString();
  db.update(cards).set({ archived: true, updatedAt: now }).where(eq(cards.id, id)).run();
  return getCard(db, id);
}

export function getCardIterations(db: Db, cardId: string) {
  return db.select().from(iterations).where(eq(iterations.cardId, cardId)).all();
}

export function createIteration(
  db: Db,
  input: { cardId: string; iterationNumber: number; logText: string; commitSha?: string }
) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.insert(iterations).values({ id, ...input, commitSha: input.commitSha ?? null, createdAt: now }).run();
  return id;
}
