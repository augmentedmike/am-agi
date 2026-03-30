import { eq, and, sql, inArray } from 'drizzle-orm';
import { cards, iterations, cardDependencies, CardState, CardPriority, CardType, WorkLogEntry, Attachment, TokenLogEntry } from './schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { randomUUID } from 'crypto';
import { getProject } from './projects';
import { version as BOARD_VERSION } from '../../package.json';
import { AM_BOARD_PROJECT_ID } from '../lib/constants';

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
  filters?: { state?: CardState; priority?: CardPriority; projectId?: string | null; all?: boolean; cardType?: CardType }
) {
  const conditions = filters?.all ? [] : [sql`${cards.archived} = 0`];
  if (filters?.state) conditions.push(eq(cards.state, filters.state));
  if (filters?.priority) conditions.push(eq(cards.priority, filters.priority));
  if (filters?.cardType) conditions.push(eq(cards.cardType, filters.cardType));
  if (filters && 'projectId' in filters) {
    const pid = filters.projectId ?? AM_BOARD_PROJECT_ID;
    conditions.push(eq(cards.projectId, pid));
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
  cardType?: CardType;
  entityFields?: Record<string, string | number | null>;
};

export function createCard(db: Db, input: CreateCardInput) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const projectId = input.projectId ?? AM_BOARD_PROJECT_ID;
  let version: string | null = input.version ?? null;
  if (version === null) {
    const project = getProject(db, projectId);
    if (project?.versioned && project.currentVersion) {
      version = project.currentVersion;
    } else if (projectId === AM_BOARD_PROJECT_ID) {
      version = BOARD_VERSION;
    }
  }
  const card = {
    id,
    title: input.title,
    state: 'backlog' as CardState,
    priority: input.priority ?? 'normal' as CardPriority,
    attachments: [] as Attachment[],
    workLog: [] as WorkLogEntry[],
    workDir: input.workDir ?? null,
    projectId,
    parentId: input.parentId ?? null,
    version,
    cardType: (input.cardType ?? 'task') as CardType,
    entityFields: input.entityFields ?? {} as Record<string, string | number | null>,
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
  projectId?: string;
  deps?: string[];
  cardType?: CardType;
  entityFields?: Record<string, string | number | null>;
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
  // Merge entityFields patch into existing fields
  const mergedEntityFields = input.entityFields !== undefined
    ? { ...(card.entityFields ?? {}), ...input.entityFields }
    : (card.entityFields ?? {});

  db.update(cards)
    .set({
      title: input.title ?? card.title,
      priority: input.priority ?? card.priority,
      state: card.state,
      workLog: newWorkLog,
      tokenLogs: newTokenLogs,
      attachments: newAttachments,
      workDir: input.workDir ?? card.workDir,
      version: input.version ?? card.version,
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.deps !== undefined ? { deps: input.deps } : {}),
      ...(input.cardType !== undefined ? { cardType: input.cardType } : {}),
      entityFields: mergedEntityFields,
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

export function resetCard(db: Db, id: string) {
  const now = new Date().toISOString();
  db.update(cards).set({
    state: 'backlog',
    attachments: [],
    workLog: [],
    tokenLogs: [],
    workDir: null,
    inProgressAt: null,
    inReviewAt: null,
    shippedAt: null,
    updatedAt: now,
  }).where(eq(cards.id, id)).run();
  db.delete(iterations).where(eq(iterations.cardId, id)).run();
  return getCard(db, id);
}

/** Check dep gate: returns a list of failure strings (empty = allowed). */
export function checkDepGate(db: Db, cardId: string): string[] {
  const card = getCard(db, cardId);
  if (!card) return [`Card ${cardId} not found`];
  const deps: string[] = (card as { deps?: string[] }).deps ?? [];
  const failures: string[] = [];
  for (const depId of deps) {
    const dep = getCard(db, depId);
    if (!dep) {
      failures.push(`Dependency ${depId} (unknown) not found`);
    } else if (dep.state !== 'shipped') {
      failures.push(`Dependency ${depId} (${dep.title}) is not shipped (state: ${dep.state})`);
    }
  }
  return failures;
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

export type DependencyCard = { id: string; title: string; state: CardState };

export function addDependency(db: Db, cardId: string, dependsOnId: string): void {
  const now = new Date().toISOString();
  const id = randomUUID();
  db.insert(cardDependencies).values({ id, cardId, dependsOnId, createdAt: now }).run();
}

export function removeDependency(db: Db, cardId: string, dependsOnId: string): void {
  db.delete(cardDependencies)
    .where(and(eq(cardDependencies.cardId, cardId), eq(cardDependencies.dependsOnId, dependsOnId)))
    .run();
}

export function getDependencies(db: Db, cardId: string): DependencyCard[] {
  const rows = db.select({ id: cardDependencies.dependsOnId })
    .from(cardDependencies)
    .where(eq(cardDependencies.cardId, cardId))
    .all();
  if (rows.length === 0) return [];
  const depIds = rows.map(r => r.id);
  return db.select({ id: cards.id, title: cards.title, state: cards.state })
    .from(cards)
    .where(inArray(cards.id, depIds))
    .all() as DependencyCard[];
}
