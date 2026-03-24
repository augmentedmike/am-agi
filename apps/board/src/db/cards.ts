import { eq, and } from 'drizzle-orm';
import { cards, iterations, CardState, CardPriority, WorkLogEntry, Attachment } from './schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { randomUUID } from 'crypto';

type Db = BetterSQLite3Database<typeof schema>;

export function listCards(
  db: Db,
  filters?: { state?: CardState; priority?: CardPriority }
) {
  const conditions = [];
  if (filters?.state) conditions.push(eq(cards.state, filters.state));
  if (filters?.priority) conditions.push(eq(cards.priority, filters.priority));
  return conditions.length > 0
    ? db.select().from(cards).where(and(...conditions)).all()
    : db.select().from(cards).all();
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
};

export function updateCard(db: Db, id: string, input: UpdateCardInput) {
  const card = getCard(db, id);
  if (!card) return null;
  const now = new Date().toISOString();
  const newWorkLog = input.workLogEntry
    ? [...card.workLog, input.workLogEntry]
    : card.workLog;
  const newAttachments = input.attachment
    ? [...card.attachments, input.attachment]
    : card.attachments;
  db.update(cards)
    .set({
      title: input.title ?? card.title,
      priority: input.priority ?? card.priority,
      workLog: newWorkLog,
      attachments: newAttachments,
      updatedAt: now,
    })
    .where(eq(cards.id, id))
    .run();
  return getCard(db, id);
}

export function moveCard(db: Db, id: string, newState: CardState) {
  const now = new Date().toISOString();
  db.update(cards).set({ state: newState, updatedAt: now }).where(eq(cards.id, id)).run();
  return getCard(db, id);
}

export function archiveCard(db: Db, id: string) {
  const now = new Date().toISOString();
  db.update(cards).set({ state: 'shipped' as CardState, updatedAt: now }).where(eq(cards.id, id)).run();
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
