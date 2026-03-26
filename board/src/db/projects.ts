import { eq } from 'drizzle-orm';
import { projects } from './schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { randomUUID } from 'crypto';

type Db = BetterSQLite3Database<typeof schema>;

// Port layout:
//   4200 — AM Board production (next start)
//   4201 — WebSocket server
//   4202 — AM Board dev (next dev --turbopack)
//   4203+ — custom projects: even=prod, odd=dev (step 2 per project)
const PROJECT_PORT_BASE = 4203;

function allocatePorts(db: Db): { prodPort: number; devPort: number } {
  const existing = db.select().from(projects).all();
  const usedProdPorts = new Set(existing.map(p => p.prodPort).filter(Boolean));
  let prodPort = PROJECT_PORT_BASE;
  while (usedProdPorts.has(prodPort)) prodPort += 2;
  return { prodPort, devPort: prodPort + 1 };
}

export function listProjects(db: Db) {
  return db.select().from(projects).all();
}

export function getProject(db: Db, id: string) {
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

export function createProject(db: Db, input: { name: string; repoDir: string }) {
  const now = new Date().toISOString();
  const { prodPort, devPort } = allocatePorts(db);
  const project = {
    id: randomUUID(),
    name: input.name,
    repoDir: input.repoDir,
    prodPort,
    devPort,
    demoUrl: `http://localhost:${prodPort}`,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(projects).values(project).run();
  return project;
}

export function updateProject(db: Db, id: string, input: { name?: string; repoDir?: string; demoUrl?: string }) {
  const existing = getProject(db, id);
  if (!existing) return null;
  const now = new Date().toISOString();
  db.update(projects).set({
    name: input.name ?? existing.name,
    repoDir: input.repoDir ?? existing.repoDir,
    demoUrl: input.demoUrl !== undefined ? input.demoUrl : existing.demoUrl,
    updatedAt: now,
  }).where(eq(projects.id, id)).run();
  return getProject(db, id);
}

export function deleteProject(db: Db, id: string) {
  db.delete(projects).where(eq(projects.id, id)).run();
}
