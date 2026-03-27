import { eq, and, sql, inArray } from 'drizzle-orm';
import { cards, iterations, CardState, CardPriority, WorkLogEntry, Attachment, TokenLogEntry } from './schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { randomUUID } from 'crypto';

type Db = BetterSQLite3Database<typeof schema>;

/** Returns the latest commitSha per cardId from the iterations table. */
function latestCommitShas(db: Db, cardIds: string[]): Map<string, string | null> {
  if (cardIds.length === 0) return new Map();
  const iters = db.select({ cardId: iterations.cardId, commitSha: iterations.commitSha })
    .from(iterations)
    .where(inArray(iterations.cardId, cardIds))
    .orderBy(sql`${iterations.iterationNumber} DESC`)
    .all();
  const map = new Map<string, string | null>();
  for (const iter of iters) {
    if (!map.has(iter.cardId)) map.set(iter.cardId, iter.commitSha ?? null);
  }
  return map;
}

export function listCards(
  db: Db,
  filters?: { state?: CardState; priority?: CardPriority; projectId?: string | null }
) {
  const conditions = [sql`${cards.archived} = 0`];
  if (filters?.state) conditions.push(eq(cards.state, filters.state));
  if (filters?.priority) conditions.push(eq(cards.priority, filters.priority));
  if (filters && 'projectId' in filters) {
    conditions.push(
      filters.projectId === null || filters.projectId === undefined
        ? sql`${cards.projectId} IS NULL`
        : eq(cards.projectId, filters.projectId)
    );
  }
  const result = db.select().from(cards).where(and(...conditions)).all();
  if (result.length === 0) return result.map(c => ({ ...c, commitSha: null as string | null }));
  const shaMap = latestCommitShas(db, result.map(c => c.id));
  return result.map(c => ({ ...c, commitSha: shaMap.get(c.id) ?? null }));
}

export function getCard(db: Db, id: string) {
  const card = db.select().from(cards).where(eq(cards.id, id)).get();
  if (!card) return card; // preserve undefined for not-found
  const latestIter = db.select({ commitSha: iterations.commitSha })
    .from(iterations)
    .where(eq(iterations.cardId, id))
    .orderBy(sql`${iterations.iterationNumber} DESC`)
    .limit(1)
    .get();
  return { ...card, commitSha: latestIter?.commitSha ?? null };
}

export type CreateCardInput = {
  title: string;
  priority?: CardPriority;
  workDir?: string;
  projectId?: string | null;
  parentId?: string | null;
  version?: string;
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
    projectId: input.projectId ?? null,
    parentId: input.parentId ?? null,
    version: input.version ?? null,
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
  tokenLogEntry?: TokenLogEntry;
  attachment?: Attachment;
  attachments?: string[];
  replaceAttachments?: Attachment[];
  removeAttachment?: string;
  workDir?: string;
  version?: string;
  prUrl?: string | null;
};

export function updateCard(db: Db, id: string, input: UpdateCardInput) {
  const card = getCard(db, id);
  if (!card) return null;
  const now = new Date().toISOString();
  const newWorkLog = input.workLogEntry
    ? [...card.workLog, input.workLogEntry]
    : card.workLog;
  const newTokenLogs = input.tokenLogEntry
    ? [...(card.tokenLogs ?? []), input.tokenLogEntry]
    : (card.tokenLogs ?? []);
  // replaceAttachments wholesale replaces the attachment list (used when persisting to workspaces)
  let newAttachments: Attachment[];
  if (input.replaceAttachments) {
    newAttachments = input.replaceAttachments;
  } else {
    const existingPaths = new Set(card.attachments.map(a => a.path));
    const addedFromPaths: Attachment[] = (input.attachments ?? [])
      .filter(p => !existingPaths.has(p))
      .map(p => ({ path: p, name: p.split('/').pop() ?? p }));
    const addedFromSingle: Attachment[] = input.attachment && !existingPaths.has(input.attachment.path)
      ? [input.attachment]
      : [];
    const merged = [...card.attachments, ...addedFromPaths, ...addedFromSingle];
    newAttachments = input.removeAttachment
      ? merged.filter(a => a.path !== input.removeAttachment)
      : merged;
  }
  db.update(cards)
    .set({
      title: input.title ?? card.title,
      priority: input.priority ?? card.priority,
      workLog: newWorkLog,
      tokenLogs: newTokenLogs,
      attachments: newAttachments,
      workDir: input.workDir ?? card.workDir,
      version: input.version ?? card.version,
      ...(input.prUrl !== undefined ? { prUrl: input.prUrl } : {}),
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

export function getIteration(db: Db, id: string) {
  return db.select().from(iterations).where(eq(iterations.id, id)).get();
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
