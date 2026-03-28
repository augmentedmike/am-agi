import { eq } from 'drizzle-orm';
import { projects } from './schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { randomUUID } from 'crypto';

type Db = BetterSQLite3Database<typeof schema>;

export function listProjects(db: Db) {
  return db.select().from(projects).all();
}

export function getProject(db: Db, id: string) {
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

export function createProject(db: Db, input: { name: string; repoDir: string; versioned?: boolean; isTest?: boolean }) {
  const now = new Date().toISOString();
  const project = { id: randomUUID(), name: input.name, repoDir: input.repoDir, versioned: input.versioned ?? false, isTest: input.isTest ?? false, createdAt: now, updatedAt: now };
  db.insert(projects).values(project).run();
  return project;
}

export function updateProject(db: Db, id: string, input: { name?: string; repoDir?: string; versioned?: boolean; isTest?: boolean; githubRepo?: string; vercelUrl?: string; currentVersion?: string }) {
  const existing = getProject(db, id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const willBeVersioned = input.versioned ?? existing.versioned;
  const explicitVersion = input.currentVersion;
  const autoVersion = willBeVersioned && !existing.currentVersion && explicitVersion === undefined ? '0.0.1' : undefined;
  db.update(projects).set({
    name: input.name ?? existing.name,
    repoDir: input.repoDir ?? existing.repoDir,
    versioned: input.versioned ?? existing.versioned,
    isTest: input.isTest ?? existing.isTest,
    ...(input.githubRepo !== undefined ? { githubRepo: input.githubRepo } : {}),
    ...(input.vercelUrl !== undefined ? { vercelUrl: input.vercelUrl } : {}),
    ...(explicitVersion !== undefined ? { currentVersion: explicitVersion } : autoVersion !== undefined ? { currentVersion: autoVersion } : {}),
    updatedAt: now,
  }).where(eq(projects.id, id)).run();
  return getProject(db, id);
}

export function deleteProject(db: Db, id: string) {
  db.delete(projects).where(eq(projects.id, id)).run();
}
